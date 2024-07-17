use crate::{
    config::{Cluster, HelmDeploymentState, VipIp},
    internal_config::INTERNAL_CONFIG,
    some_or_bail,
    utils::cmd,
};
use anyhow::Context;
use serde_json::json;
use std::io::Write;
use tempfile::NamedTempFile;
use tokio::fs;
use tracing::debug;

pub struct ClusterNetwork;

impl ClusterNetwork {
    pub async fn install(cluster: &Cluster) -> anyhow::Result<()> {
        ClusterNetwork::install_network(cluster).await?;
        ClusterNetwork::install_kubevip(&cluster.vip.controlplane).await?;

        Ok(())
    }

    async fn install_kubevip(cp_vip_config: &VipIp) -> anyhow::Result<()> {
        let vip = some_or_bail!(
            cp_vip_config.legacy_ip,
            "No control plane legacy vip address set"
        )
        .to_string();
        let vip_interface = "enp1s0";
        // update the version by creating a new manifest with
        // bash scripts/generate-kube-vip-files.sh VERSION

        debug!("Installing kube-vip");

        let template_manifest =
            fs::read_to_string("/install/core-apis/kube-vip/manifest.yml").await?;

        let mut manifest_tempfile =
            NamedTempFile::new().context("Failed to create temporary file")?;

        let manifest = template_manifest
            .replace("$$$VIP$$$", &vip)
            .replace("$$$VIP_INTERFACE$$$", vip_interface);

        writeln!(manifest_tempfile, "{}", &manifest,)
            .context("Failed to write to temporary file")?;

        // create the mows-vip namespace

        let _ = cmd(
            vec!["kubectl", "create", "namespace", "mows-vip"],
            "Failed to install kube-vip namespace",
        )
        .await;

        cmd(
            vec![
                "kubectl",
                "apply",
                "-f",
                "/install/core-apis/kube-vip/cluster-role.yml",
            ],
            "Failed to install kube-vip cluster role",
        )
        .await?;

        cmd(
            vec![
                "kubectl",
                "apply",
                "-f",
                some_or_bail!(manifest_tempfile.path().to_str(), "No path"),
            ],
            "Failed to install kube-vip manifest",
        )
        .await?;

        debug!("Kube-vip installed");

        Ok(())
    }

    async fn install_cilium_resources(namespace: &str) -> anyhow::Result<()> {
        let ic = &INTERNAL_CONFIG;

        let ip_resources = format!(
            r#"
apiVersion: cilium.io/v2alpha1
kind: CiliumLoadBalancerIPPool
metadata:
  name: default-pool
  namespace: {namespace}
spec:
  blocks:
    - start: {}
      stop: {}
---
apiVersion: cilium.io/v2alpha1
kind: CiliumL2AnnouncementPolicy
metadata:
  name: default-l2-announcement-policy
  namespace: {namespace}
spec:
  externalIPs: true
  loadBalancerIPs: true
        "#,
            ic.cluster.network.start, ic.cluster.network.end
        );

        let mut resources_tempfile =
            NamedTempFile::new().context("Failed to create temporary file")?;

        writeln!(resources_tempfile, "{}", &ip_resources).context("Failed to write file")?;

        cmd(
            vec![
                "kubectl",
                "apply",
                "-f",
                "/install/core-apis/network/ip-pool.yml",
            ],
            "Failed to apply cilium ip pool",
        )
        .await?;

        if INTERNAL_CONFIG.dev.enabled && INTERNAL_CONFIG.dev.skip_network_policy_install {
            debug!("Skipping network policy installation");
        } else {
            cmd(
                vec![
                    "kubectl",
                    "apply",
                    "-f",
                    "/install/core-apis/network/policies/",
                ],
                "Failed to apply cilium network policy",
            )
            .await?;
        }

        Ok(())
    }

    pub async fn install_network(cluster: &Cluster) -> anyhow::Result<()> {
        let name = "mows-network";

        // check if cilium is already installed

        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            ClusterNetwork::install_cilium_resources(&name).await?;

            return Ok(()); // network is already installed
        }

        debug!("Installing cilium network");

        let cilium_version = "1.15.0";

        cmd(
            vec!["helm", "repo", "add", "cilium", "https://helm.cilium.io/"],
            "Failed to add cilium helm repo",
        )
        .await?;

        cmd(
            vec!["helm", "repo", "update"],
            "Failed to update helm repos",
        )
        .await?;

        let values = json!({
            /*
            "prometheus": {
                "enabled": true,
            },*/
            "operator": {
                "replicas": 1,
                "rollOutPods": true,
                /*
                "prometheus": {
                    "enabled": true
                }*/
            },
            "hubble": {
                "relay": {
                    "enabled": true
                },
                "ui": {
                    "enabled": true
                },
                "enabled": true,
                /*
                "metrics": {
                    "enableOpenMetrics": true,
                    "serviceMonitor":{
                        "enabled": false,
                    },
                    "dashboards": {
                        "enabled": true
                    },
                    // "{dns,drop,tcp,flow,port-distribution,icmp,httpV2:exemplars=true;labelsContext=source_ip,source_namespace,source_workload,destination_ip,destination_namespace,destination_workload,traffic_direction}"
                    "enabled": ["dns", "drop", "tcp", "flow", "port-distribution", "icmp", "httpV2"]
                }*/
            },
            "kubeProxyReplacement": "strict",
            "k8sServiceHost": "127.0.0.1",
            "k8sServicePort": 6443,
            "externalIPs": {
                "enabled": false
            },
            "cluster": {
                "name": cluster.id
            },
            "bgpControlPlane": {
                "enabled": true
            },
            "l2announcements": {
                "enabled": true
            },
            "k8sClientRateLimit": {
                "qps": 32,
                "burst": 64
            },
            "gatewayAPI": {
                "enabled": true
            },
            "enableCiliumEndpointSlice": true,
            "debug": {
                "enabled": true
            },
            "rollOutCiliumPods": true,
            "hostFirewall": {
                "enabled": true
            },
            "encryption":{
                "enabled": true,
                "type":"wireguard",
                "nodeEncryption":true
            }
        });

        let mut tempfile =
            NamedTempFile::new().context("Failed to create temporary helm values file ")?;
        writeln!(tempfile, "{}", &values).context("Failed to write helm values file")?;

        cmd(
            vec![
                "helm",
                "upgrade",
                // release
                name,
                // chart
                "cilium/cilium",
                //
                "--install",
                //
                "--create-namespace",
                //
                "--namespace",
                name,
                //
                "--version",
                cilium_version,
                "--values",
                tempfile.path().to_str().unwrap(),
            ],
            "Failed to install cilium",
        )
        .await?;

        ClusterNetwork::install_cilium_resources(&name).await?;

        debug!("Cilium network installed");

        Ok(())
    }
}
