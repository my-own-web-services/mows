use anyhow::Context;
use serde_json::json;
use std::io::Write;
use tempfile::NamedTempFile;
use tracing::debug;

use crate::{
    config::{Cluster, HelmDeploymentState},
    utils::cmd,
};

pub struct ClusterPolicy;

impl ClusterPolicy {
    pub async fn install() -> anyhow::Result<()> {
        Self::install_kyverno().await?;

        Self::install_policies().await?;

        Self::install_policy_reporter().await?;

        Ok(())
    }

    async fn install_policy_reporter() -> anyhow::Result<()> {
        let version = "2.24.0";
        let name = "policy-reporter";
        let namespace = "mows-police";

        if Cluster::check_helm_deployment_state(name, namespace).await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(());
        }

        debug!("Installing policy reporter");

        cmd(
            vec![
                "helm",
                "repo",
                "add",
                "policy-reporter",
                "https://kyverno.github.io/policy-reporter",
            ],
            "Failed to add kyverno policy reporter helm repo",
        )
        .await?;

        cmd(
            vec!["helm", "repo", "update"],
            "Failed to update helm repos",
        )
        .await?;

        let values = json!({
            "kyvernoPlugin": {
                "enabled": true,
            },
            "ui":{
                "enabled": true,
                "plugins":{
                    "kyverno":true
                }
            }
        });

        let mut tempfile = NamedTempFile::new().context("Failed to create temporary file")?;
        writeln!(tempfile, "{}", &values).context("Failed to write helm values file")?;

        cmd(
            vec![
                "helm",
                "upgrade",
                // release
                name,
                // chart
                "policy-reporter/policy-reporter",
                //
                "--install",
                //
                "--create-namespace",
                //
                "--namespace",
                namespace,
                //
                "--version",
                version,
                //
                "--values",
                tempfile.path().to_str().unwrap(),
            ],
            "Failed to install policy reporter",
        )
        .await?;

        debug!("Policy reporter installed");

        Ok(())
    }

    async fn install_policies() -> anyhow::Result<()> {
        let version = "3.2.5";
        let namespace = "mows-police";
        let name = "kyverno-default-policies";

        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(());
        }

        debug!("Installing default policies");

        cmd(
            vec![
                "helm",
                "repo",
                "add",
                "kyverno",
                "https://kyverno.github.io/kyverno/",
            ],
            "Failed to add kyverno helm repo",
        )
        .await?;

        cmd(
            vec!["helm", "repo", "update"],
            "Failed to update helm repos",
        )
        .await?;

        let values = json!({
            "validationFailureAction": "Enforce",
        });

        let mut tempfile = NamedTempFile::new().context("Failed to create temporary file")?;
        writeln!(tempfile, "{}", &values).context("Failed to write helm values file")?;

        cmd(
            vec![
                "helm",
                "upgrade",
                // release
                name,
                // chart
                "kyverno/kyverno-policies",
                //
                "--install",
                //
                "--create-namespace",
                //
                "--namespace",
                namespace,
                //
                "--version",
                version,
                //
                "--values",
                tempfile.path().to_str().unwrap(),
            ],
            "Failed to install default policies",
        )
        .await?;

        debug!("Default policies installed");

        Ok(())
    }

    async fn install_kyverno() -> anyhow::Result<()> {
        let version = "3.2.6";
        let name = "mows-police";

        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(());
        }

        debug!("Installing policy engine");

        cmd(
            vec![
                "helm",
                "repo",
                "add",
                "kyverno",
                "https://kyverno.github.io/kyverno/",
            ],
            "Failed to add kyverno helm repo",
        )
        .await?;

        cmd(
            vec!["helm", "repo", "update"],
            "Failed to update helm repos",
        )
        .await?;

        let values = json!({
            "grafana": {
                "enabled": true,
            },
            "features": {
                "backgroundScan": {
                    "backgroundScanInterval":"1m",
                }
            },
            "admissionController": {
                "serviceMonitor": {
                    "enabled":true
                }
            },
            "backgroundController": {
                "serviceMonitor": {
                    "enabled":true
                }
            },
            "cleanupController": {
                "serviceMonitor": {
                    "enabled":true
                }
            },
            "config":{
                //"resourceFiltersIncludeNamespaces":["mows-network","mows-storage","mows-vip"],
                "webhooks":[
                    {
                        "namespaceSelector":{
                            "matchExpressions":[
                                {
                                    "key":"mows.cloud/core-apis-disable-kyverno",
                                    "operator":"NotIn",
                                    "values":["true"]
                                }
                            ]
                        },
                    }
                ],

            },
        });

        let mut tempfile = NamedTempFile::new().context("Failed to create temporary file")?;
        writeln!(tempfile, "{}", &values).context("Failed to write helm values file")?;

        cmd(
            vec![
                "helm",
                "upgrade",
                // release
                name,
                // chart
                "kyverno/kyverno",
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
            "Failed to install mows-police",
        )
        .await?;

        debug!("Policy engine installed");

        Ok(())
    }
}
