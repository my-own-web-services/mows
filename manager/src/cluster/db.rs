use crate::{
    config::{Cluster, HelmDeploymentState},
    utils::cmd,
};

pub struct ClusterDatabases;

impl ClusterDatabases {
    pub async fn install(cluster: &Cluster) -> anyhow::Result<()> {
        Self::install_postgres().await?;

        Ok(())
    }

    pub async fn install_postgres() -> anyhow::Result<()> {
        let version = "0.21.5";
        let name = "mows-db-pg";

        if Cluster::check_helm_deployment_state(name, name).await?
            != HelmDeploymentState::NotInstalled
        {
            return Ok(());
        }

        cmd(
            vec![
                "helm",
                "repo",
                "add",
                "cloudnative-pg",
                "https://cloudnative-pg.github.io/charts",
            ],
            "Failed to add cnpg helm repo",
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
                "cloudnative-pg/cloudnative-pg",
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
            ],
            "Failed to install cnpg",
        )
        .await?;

        Ok(())
    }
}
