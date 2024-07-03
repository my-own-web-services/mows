use crate::{
    config::{Cluster, HelmDeploymentState},
    some_or_bail,
    utils::cmd,
};
use anyhow::Context;
use std::io::Write;
use tempfile::NamedTempFile;
use tokio::fs;
use tracing::debug;
use tracing_subscriber::field::debug;

pub struct ClusterNetwork;

impl ClusterNetwork {
    pub async fn install(cluster: &Cluster) -> anyhow::Result<()> {
        ClusterNetwork::install_network(cluster).await?;
        ClusterNetwork::install_kubevip().await?;
        ClusterNetwork::install_local_ingress(cluster).await?;

        Ok(())
    }

    pub async fn install_kubevip() -> anyhow::Result<()> {
        let vip = "192.168.112.49";
        let vip_interface = "enp1s0";
        // update the version by creating a new manifest with
        // bash scripts/generate-kube-vip-files.sh VERSION

        debug!("Installing kube-vip");

        let template_manifest =
            fs::read_to_string("/install/cluster-basics/kube-vip/manifest.yml").await?;

        let mut manifest_tempfile =
            NamedTempFile::new().context("Failed to create temporary file")?;

        let manifest = template_manifest
            .replace("$$$VIP$$$", vip)
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
                "/install/cluster-basics/kube-vip/cluster-role.yml",
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

    pub async fn install_local_ingress(cluster: &Cluster) -> anyhow::Result<()> {
        let version = "28.3.0";
        let name = "mows-ingress";

        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(());
        }

        let service_vip = some_or_bail!(&cluster.vip.service.legacy_ip, "No service vip");

        debug!("Installing traefik ingress");

        cmd(
            vec![
                "helm",
                "repo",
                "add",
                "traefik",
                "https://traefik.github.io/charts",
            ],
            "Failed to add traefik helm repo",
        )
        .await?;

        cmd(
            vec!["helm", "repo", "update"],
            "Failed to update helm repos",
        )
        .await?;

        cmd(
            vec![
                "helm",
                "upgrade",
                // release
                name,
                // chart
                "traefik/traefik",
                //
                "--install",
                //
                "--create-namespace",
                //
                "--namespace",
                name,
                //
                "--version",
                version,
                //
                "--set",
                "additional.sendAnonymousUsage=false",
                //
                "--set",
                &format!(
                    "'service.annotations.\"io\\.cilium/lb-ipam-ips\"={}'",
                    service_vip
                ),
            ],
            "Failed to install traefik",
        )
        .await?;

        debug!("Traefik ingress installed");

        Ok(())
    }

    pub async fn install_network(cluster: &Cluster) -> anyhow::Result<()> {
        let name = "mows-network";

        // check if cilium is already installed

        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            cmd(
                vec![
                    "kubectl",
                    "apply",
                    "-f",
                    "/install/cluster-basics/network/resources.yml",
                ],
                "Failed to apply cilium network policy",
            )
            .await?;
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
                //
                "--set",
                "operator.replicas=1",
                //
                "--set",
                "hubble.relay.enabled=true",
                //
                "--set",
                "hubble.ui.enabled=true",
                //
                "--set",
                "hubble.enabled=true",
                //
                "--set",
                "kubeProxyReplacement=strict",
                //
                "--set",
                "k8sServiceHost=127.0.0.1",
                //
                "--set",
                "k8sServicePort=6443",
                //
                "--set",
                "externalIPs.enabled=true",
                //
                "--set",
                &format!("cluster.name={}", cluster.id),
                //
                "--set",
                "bgpControlPlane.enabled=true",
                //
                "--set",
                "l2announcements.enabled=true",
                //
                "--set",
                "k8sClientRateLimit.qps=32",
                //
                "--set",
                "k8sClientRateLimit.burst=64",
                //
                "--set",
                "gatewayAPI.enabled=true",
                //
                "--set",
                "operator.rollOutPods=true",
                //
                "--set",
                "rollOutCiliumPods=true",
                //
                "--set",
                "enableCiliumEndpointSlice=true",
                //
                "--set",
                "debug.enabled=true",
            ],
            "Failed to install cilium",
        )
        .await?;

        cmd(
            vec![
                "kubectl",
                "apply",
                "-f",
                "/install/cluster-basics/network/resources.yml",
            ],
            "Failed to apply cilium network policy",
        )
        .await?;

        debug!("Cilium network installed");

        Ok(())
    }
}
