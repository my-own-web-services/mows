use anyhow::{bail, Context};
use k8s_openapi::api::core::v1::Secret;
use tracing::debug;
use vaultrs::{
    client::{VaultClient, VaultClientSettingsBuilder},
    kv2, sys,
};

use crate::{
    config::{Cluster, VaultSecrets},
    some_or_bail, write_config,
};

pub struct ClusterSecrets;

impl ClusterSecrets {
    pub async fn setup_vault(cluster: &Cluster) -> anyhow::Result<()> {
        Self::start_vault_proxy().await?;
        let secrets = match Self::init_vault().await {
            Ok(v) => v,
            Err(e) => {
                Self::stop_vault_proxy().await?;
                bail!("Failed to initialize vault: {:?}", e);
            }
        };

        match Self::unseal_vault(secrets.clone()).await {
            Ok(_) => (),
            Err(e) => {
                Self::stop_vault_proxy().await?;
                bail!("Failed to unseal vault: {:?}", e);
            }
        };
        Self::stop_vault_proxy().await?;

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

        let client = Self::new_vault_client(None)
            .await
            .context("Failed to create vault client")?;

        let secrets = match sys::start_initialization(&client, 1, 1, None).await {
            Ok(v) => v,
            Err(e) => {
                bail!("Failed to start vault initialization: {:?}", e);
            }
        };

        let unseal_key = some_or_bail!(secrets.keys.get(0), "Secret keys not received").to_string();
        debug!("Vault initialized");

        Ok(VaultSecrets {
            root_token: secrets.root_token,
            unseal_key,
        })
    }

    pub async fn unseal_vault(vault_secrets: VaultSecrets) -> anyhow::Result<()> {
        debug!("Unsealing Vault");

        let client = Self::new_vault_client(None).await?;

        let unseal_response =
            sys::unseal(&client, Some(vault_secrets.unseal_key.clone()), None, None)
                .await
                .context("Failed to unseal Vault")?;

        if unseal_response.sealed {
            bail!("Vault is still sealed");
        }

        debug!("Vault unsealed");

        Ok(())
    }

    pub async fn start_proxy_and_setup_eso(cluster: &Cluster) -> anyhow::Result<()> {
        debug!("Setting up ESO");

        Self::start_vault_proxy().await?;

        let res = Self::setup_eso(cluster).await;

        Self::stop_vault_proxy().await?;

        res
    }

    async fn setup_eso(cluster: &Cluster) -> anyhow::Result<()> {
        // first check if the secret is already present in kubernetes
        // name: mows-core-secrets-eso-token namespace: mows-core-secrets-eso

        let vault_secrets = some_or_bail!(&cluster.vault_secrets, "Vault secrets not found");

        let kc = cluster.get_kubeconfig_struct().await?;
        let kube_client = kube::client::Client::try_from(kc.clone())?;

        let secret_api: kube::Api<Secret> =
            kube::Api::namespaced(kube_client.clone(), "mows-core-secrets-eso");

        if let Ok(_) = secret_api.get("mows-core-secrets-eso-token").await {
            debug!("ESO secret already exists");
            return Ok(());
        }

        // create the vault kv2 engine with path mows-core-secrets-eso

        let vault_client = Self::new_vault_client(Some(&vault_secrets.root_token)).await?;

        vaultrs::sys::mount::enable(&vault_client, "mows-core-secrets-eso", "kv-v2", None).await?;

        // enable kubernetes auth
        vaultrs::sys::auth::enable(&vault_client, "kubernetes", "kubernetes", None).await?;

        debug!("ESO vault engine created");

        Ok(())
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

        //sleep 1 sec
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

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

    pub async fn new_vault_client(token: Option<&str>) -> anyhow::Result<VaultClient> {
        let mut client_builder = VaultClientSettingsBuilder::default();

        client_builder.address("http://127.0.0.1:8200");

        if let Some(token) = token {
            client_builder.token(token);
        }

        let vc = VaultClient::new(
            client_builder
                .build()
                .context("Failed to create vault client")?,
        )?;

        Ok(vc)
    }
}
