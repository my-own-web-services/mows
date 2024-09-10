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
use tokio::{fs, time::sleep};
use tracing::debug;

pub struct ClusterNetwork;

impl ClusterNetwork {
    pub async fn install(cluster: &Cluster) -> anyhow::Result<()> {
        ClusterNetwork::install_network().await?;
        ClusterNetwork::install_vip().await?;
        Ok(())
    }

    async fn write_cilium_resources(namespace: &str) -> anyhow::Result<()> {
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

    pub async fn install_vip() -> anyhow::Result<()> {
        debug!("Installing kube-vip");

        Cluster::install_with_kustomize("/install/argocd/core/network/vip/").await?;

        debug!("kube-vip installed");

        Ok(())
    }

    pub async fn install_network() -> anyhow::Result<()> {
        debug!("Installing cilium network");

        Cluster::install_with_kustomize("/install/argocd/core/network/cilium/").await?;

        // we need to run this a second time as the crds are not installed in the first run

        sleep(std::time::Duration::from_secs(5)).await;

        Cluster::install_with_kustomize("/install/argocd/core/network/cilium/").await?;

        debug!("Cilium network installed");

        Ok(())
    }
}
