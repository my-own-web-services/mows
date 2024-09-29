use anyhow::bail;
use tracing::debug;
use vaultrs::{
    client::{VaultClient, VaultClientSettingsBuilder},
    sys,
};

use crate::{
    config::{Cluster, VaultSecrets},
    some_or_bail, write_config,
};

pub struct ClusterSecrets;

impl ClusterSecrets {
    pub async fn setup(cluster: &Cluster) -> anyhow::Result<()> {
        Self::start_vault_proxy().await?;
        let secrets = Self::init_vault().await?;
        Self::unseal_vault(secrets.clone()).await?;

        let mut config = write_config!();

        let mut_cluster = some_or_bail!(
            config.clusters.get_mut(&cluster.id),
            "Cluster not found in config"
        );

        mut_cluster.vault_secrets = Some(secrets);

        drop(config);

        Ok(())
    }

    pub async fn init_vault() -> anyhow::Result<VaultSecrets> {
        debug!("Initializing vault");

        let client = VaultClient::new(
            VaultClientSettingsBuilder::default()
                .address("http://127.0.0.1:8200")
                .build()
                .unwrap(),
        )?;

        let secrets = sys::start_initialization(&client, 1, 1, None).await?;

        let unseal_key = some_or_bail!(secrets.keys.get(0), "Secret keys not received").to_string();
        debug!("Vault initialized");

        Ok(VaultSecrets {
            root_token: secrets.root_token,
            unseal_key,
        })
    }

    pub async fn start_vault_proxy() -> anyhow::Result<()> {
        debug!("Starting Vault proxy");

        Cluster::start_kubectl_port_forward(
            "mows-core-secrets-vault",
            "service/mows-core-secrets-vault",
            8200,
            8200,
            false,
        )
        .await?;

        debug!("Vault proxy started");

        Ok(())
    }

    pub async fn stop_vault_proxy() -> anyhow::Result<()> {
        debug!("Stopping Vault proxy");

        Cluster::stop_kubectl_port_forward(
            "mows-core-secrets-vault",
            "service/mows-core-secrets-vault",
        )
        .await?;

        debug!("Vault proxy stopped");

        Ok(())
    }

    pub async fn unseal_vault(vault_secrets: VaultSecrets) -> anyhow::Result<()> {
        debug!("Unsealing Vault");

        let client = VaultClient::new(
            VaultClientSettingsBuilder::default()
                .address("http://127.0.0.1:8200")
                .build()
                .unwrap(),
        )?;

        let unseal_response =
            sys::unseal(&client, Some(vault_secrets.unseal_key.clone()), None, None).await?;

        if unseal_response.sealed {
            bail!("Vault is still sealed");
        }

        debug!("Vault unsealed");

        Ok(())
    }
}
