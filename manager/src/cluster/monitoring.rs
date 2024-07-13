use anyhow::Context;
use serde_json::json;
use std::io::Write;
use tempfile::NamedTempFile;
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
    async fn install_monitoring(cluster: &Cluster) -> anyhow::Result<()> {
        let name = "mows-monitoring";
        let version = "61.3.0";

        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(());
        }

        debug!("Installing monitoring");

        // create namespace
        let _ = cmd(
            vec!["kubectl", "create", "namespace", name],
            "Failed to create namespace",
        )
        .await;

        // apply additional dashboards
        cmd(
            vec![
                "kubectl",
                "apply",
                "-f",
                "/install/core-apis/monitoring/grafana/dashboards",
            ],
            "Failed to apply additional dashboards",
        )
        .await?;

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

        // collect the cluster endpoints as json array of strings of their hostname
        let cp_endpoints = cluster
            .cluster_nodes
            .iter()
            .map(|node| node.1.internal_ips.legacy.to_string())
            .collect::<Vec<String>>();

        let values = json!({
            "prometheus":{
                "prometheusSpec": {
                    "logLevel": "debug",
                    "serviceMonitorSelectorNilUsesHelmValues":false,
                }
            },
            "nodeExporter":{
                "enabled":false // this exposes the node exporter on the host network which is not secure
            },
            "prometheus-node-exporter":{
                "extraArgs":[
                    "--web.listen-address=127.0.0.1:9100" // port is already in use ?
                ]

            },
            "prometheusOperator":{
                "networkPolicy": {
                    "enabled": true,
                    "flavor":"cilium"
                },
            },
            "kubeProxy": {
                "enabled":false
            },
            "kubeEtcd": {
                "enabled": true,
                "endpoints": cp_endpoints,
                "service":{
                    "enabled": true,
                    "port": 2381,
                    "targetPort": 2381
                },
                "serviceMonitor": {
                    "enabled": true,
                    "https": true,
                    "insecureSkipVerify": true
                }
            },
            "kubeControllerManager": {
                "enabled": false,
                "endpoints": cp_endpoints,
                "service":{
                    "enabled": true,
                    "port": 10257,
                    "targetPort": 10257
                },
                "serviceMonitor": {
                    "enabled": true,
                    "https": true,
                    "insecureSkipVerify": true
                }
            },
            "kubeAPIServer": {
                "enabled": true,
            },
            "grafana": {
                "enabled": true,
                "defaultDashboardsEnabled": true,
                "forceDeployDashboards": true,
                "grafana.ini": {
                    "server": {
                        "root_url": root_url,
                    },
                    "security": {
                        "csrf_trusted_origins": "localhost",
                        "disable_gravatar": true,
                    },
                    "log": {
                        "level": "debug"
                    },
                    "analytics": {
                        "check_for_updates": false,
                        "reporting_enabled": false,
                        "enabled": false
                    }
                }
            }
        });

        let mut tempfile = NamedTempFile::new().context("Failed to create temporary file ")?;
        writeln!(tempfile, "{}", &values).context("Failed to write helm values file")?;

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
                "--values",
                tempfile.path().to_str().unwrap(),
            ],
            "Failed to install monitoring",
        )
        .await?;

        debug!("Monitoring installed");

        Ok(())
    }
}
