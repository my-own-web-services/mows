use crate::{
    config::{Cluster, VaultSecrets},
    some_or_bail, write_config,
};
use anyhow::{bail, Context};
use k8s_openapi::api::core::v1::Secret;
use serde_yaml::Value;
use std::string::String;
use tracing::debug;
use vaultrs::{
    api::auth::kubernetes::requests::ConfigureKubernetesAuthRequestBuilder,
    client::{VaultClient, VaultClientSettingsBuilder},
    kv2, sys, token,
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

        // create the vault kv2 engine with path mows-core-secrets-eso

        let vault_client = Self::new_vault_client(Some(&vault_secrets.root_token))
            .await
            .context("Failed to create vault client with root token for setting up eso")?;

        // check if the engine is already created
        let current_secret_engines = sys::mount::list(&vault_client)
            .await
            .context("Failed to list secret engines in Vault")?;

        if !current_secret_engines.contains_key(&"mows-core-secrets-eso/".to_string()) {
            vaultrs::sys::mount::enable(&vault_client, "mows-core-secrets-eso", "kv-v2", None)
                .await
                .context("Failed to create eso kv engine in Vault")?;
        }

        // check if the auth engine is already created
        let current_auth_engines = sys::auth::list(&vault_client)
            .await
            .context("Failed to list auth engines in Vault")?;

        if !current_auth_engines.contains_key(&"mows-core-secrets-eso/".to_string()) {
            vaultrs::sys::auth::enable(&vault_client, "mows-core-secrets-eso", "kubernetes", None)
                .await
                .context("Failed to create eso kubernetes auth engine in Vault")?;
        }
        let kube_api_addr = "https://127.0.0.1:6443";

        let kubeconfig_yaml: Value =
            serde_yaml::from_str(&some_or_bail!(&cluster.kubeconfig, "Missing kubeconfig"))?;

        let kubernetes_ca_cert_base64 = some_or_bail!(
            kubeconfig_yaml["clusters"][0]["cluster"]["certificate-authority-data"].as_str(),
            "Missing certificate-authority-data"
        );

        let kubernetes_ca_cert =
            String::from_utf8(data_encoding::BASE64.decode(kubernetes_ca_cert_base64.as_bytes())?)?;

        // wtf
        let kc = cluster.get_kubeconfig_struct().await?;
        let kube_client = kube::client::Client::try_from(kc.clone())?;

        let secret_api: kube::Api<Secret> =
            kube::Api::namespaced(kube_client.clone(), "mows-core-secrets-eso");

        let secret = secret_api
            .get("mows-core-secrets-eso")
            .await
            .context("Failed to fetch eso secret")?;
        let data = some_or_bail!(
            secret.data,
            "Data not found in secret mows-core-secrets-eso"
        );
        let token_bytes = some_or_bail!(
            data.get("token"),
            "Token not found in secret mows-core-secrets-eso"
        );

        let token = String::from_utf8(token_bytes.0.clone())?;

        vaultrs::auth::kubernetes::configure(
            &vault_client,
            "mows-core-secrets-eso",
            kube_api_addr,
            Some(
                &mut ConfigureKubernetesAuthRequestBuilder::default()
                    .kubernetes_host(kube_api_addr)
                    .kubernetes_ca_cert(kubernetes_ca_cert),
            ),
        )
        .await
        .context("Failed to configure kubernetes auth for eso in Vault")?;

        debug!("ESO vault engine created");

        Ok(())
    }

    pub async fn start_vault_proxy() -> anyhow::Result<()> {
        debug!("Starting Vault proxy");

        Cluster::start_kubectl_port_forward(
            "mows-core-secrets-vault",
            "service/mows-core-secrets-vault-active",
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
            "service/mows-core-secrets-vault-active",
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
