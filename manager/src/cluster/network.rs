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
        ClusterNetwork::install_kubevip().await?;
        Ok(())
    }

    pub async fn install_kubevip() -> anyhow::Result<()> {
        debug!("Installing kube-vip");

        Cluster::install_with_kustomize("/install/core/network/kubevip/").await?;

        debug!("kube-vip installed");

        Ok(())
    }

    pub async fn install_network() -> anyhow::Result<()> {
        debug!("Installing cilium network");

        Cluster::install_with_kustomize("/install/core/network/cilium/").await?;

        // we need to run this a second time as the crds are not installed in the first run

        sleep(std::time::Duration::from_secs(5)).await;

        Cluster::install_with_kustomize("/install/core/network/cilium/").await?;

        debug!("Cilium network installed");

        Ok(())
    }
}
