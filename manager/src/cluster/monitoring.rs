use tracing::debug;

use crate::{
    config::{Cluster, HelmDeploymentState},
    utils::cmd,
};

pub struct ClusterMonitoring;

impl ClusterMonitoring {
    pub async fn install(cluster: &Cluster) -> anyhow::Result<()> {
        Self::install_monitoring(cluster).await?;

        Ok(())
    }
    pub async fn install_monitoring(cluster: &Cluster) -> anyhow::Result<()> {
        let name = "mows-monitoring";
        let version = "61.2.0";

        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(());
        }

        debug!("Installing monitoring");

        cmd(
            vec![
                "helm",
                "repo",
                "add",
                "prometheus-community",
                "https://prometheus-community.github.io/helm-charts",
            ],
            "Failed to add prometheus-community helm repo",
        )
        .await?;

        cmd(
            vec!["helm", "repo", "update"],
            "Failed to update helm repos",
        )
        .await?;

        let root_url="http://localhost:8001/api/v1/namespaces/mows-monitoring/services/http:mows-monitoring-grafana:80/proxy/";

        /*

             [server]
        domain = ''
        root_url = 'http://localhost:8001/api/v1/namespaces/mows-monitoring/services/http:mows-monitoring-grafana:80/proxy/'
        serve_from_sub_path = true

            */

        cmd(
            vec![
                "helm",
                "upgrade",
                // release
                name,
                // chart
                "prometheus-community/kube-prometheus-stack",
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
                "--set",
                &format!("'\"grafana\\.ini\".server.root_url={}'", root_url),
                "--set",
                "'grafana.\"grafana\\.ini\".server.serve_from_sub_path=true'",
            ],
            "Failed to install monitoring",
        )
        .await?;

        debug!("Monitoring installed");

        Ok(())
    }
}
