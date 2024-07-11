use anyhow::Context;
use serde_json::json;
use std::io::Write;
use tempfile::NamedTempFile;
use tracing::debug;

use crate::{
    config::{Cluster, HelmDeploymentState},
    some_or_bail,
    utils::cmd,
};

pub struct ClusterLocalIngress;

impl ClusterLocalIngress {
    pub async fn install(cluster: &Cluster) -> anyhow::Result<()> {
        Self::install_local_ingress(cluster).await
    }

    async fn install_local_ingress(cluster: &Cluster) -> anyhow::Result<()> {
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

        let values = json!({
            "additional": {
                "sendAnonymousUsage": false
            },
            "service": {
                "annotations": {
                    "io.cilium/lb-ipam-ips": service_vip
                }
            },
            "metrics":{
                "prometheus":{
                    "serviceMonitor":{
                        "enabled":true,
                    },
                    "prometheusRule":{
                        "enabled":true
                    }
                }
            }
        });

        let mut tempfile = NamedTempFile::new().context("Failed to create temporary file ")?;
        writeln!(tempfile, "{}", &values).context("Failed to write file")?;

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
                "--values",
                tempfile.path().to_str().unwrap(),
            ],
            "Failed to install traefik",
        )
        .await?;

        debug!("Traefik ingress installed");

        Ok(())
    }
}
