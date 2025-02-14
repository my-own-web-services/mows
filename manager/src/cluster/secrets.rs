use crate::{
    config::{Cluster, VaultSecrets},
    s, some_or_bail,
    utils::cmd,
    write_config,
};
use anyhow::{bail, Context};
use serde_yaml::Value;
use std::string::String;
use tracing::debug;
use vaultrs::{
    api::auth::kubernetes::requests::{
        ConfigureKubernetesAuthRequestBuilder, CreateKubernetesRoleRequestBuilder,
    },
    client::{VaultClient, VaultClientSettingsBuilder},
    sys,
};

pub struct ClusterSecrets;

impl ClusterSecrets {
    pub async fn setup_vault(cluster: &Cluster) -> anyhow::Result<()> {
        let secrets = Self::init_vault().await?;

        Self::unseal_vault(&secrets).await?;

        let mut config = write_config!();

        let mut_cluster = some_or_bail!(
            config.clusters.get_mut(&cluster.id),
            "Cluster not found in config"
        );

        mut_cluster.vault_secrets = Some(secrets.clone());

        drop(config);

        //Self::join_raft_and_unseal("mows-core-secrets-vault-1", secrets.clone()).await?;
        //Self::join_raft_and_unseal("mows-core-secrets-vault-2", secrets.clone()).await?;

        Ok(())
    }

    pub async fn join_raft_and_unseal(
        pod_name: &str,
        secrets: &VaultSecrets,
    ) -> anyhow::Result<()> {
        debug!("Joining Vault to Raft");

        cmd(
            vec![
                "kubectl",
                "exec",
                "-n",
                "mows-core-secrets-vault",
                "-ti",
                pod_name,
                "--",
                "vault",
                "operator",
                "raft",
                "join",
                "http://mows-core-secrets-vault-0.mows-core-secrets-vault-internal:8200",
            ],
            &format!("Failed to join raft cluster with vault pod: {pod_name}"),
        )
        .await?;

        cmd(
            vec![
                "kubectl",
                "exec",
                "-n",
                "mows-core-secrets-vault",
                "-ti",
                pod_name,
                "--",
                "vault",
                "operator",
                "unseal",
                secrets.unseal_key.as_str(),
            ],
            &format!("Failed to unseal secondary vault pod: {pod_name}"),
        )
        .await?;

        debug!("Vault joined to Raft");

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

    pub async fn unseal_vault(vault_secrets: &VaultSecrets) -> anyhow::Result<()> {
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

    pub async fn setup_vrc(cluster: &Cluster) -> anyhow::Result<()> {
        let vault_secrets = some_or_bail!(&cluster.vault_secrets, "Vault secrets not found");

        let vault_client = Self::new_vault_client(Some(&vault_secrets.root_token))
            .await
            .context("Failed to create vault client with root token for setting up vrc")?;

        // check if the auth engine is already created
        let current_auth_engines = sys::auth::list(&vault_client)
            .await
            .context("Failed to list auth engines in Vault")?;

        if !current_auth_engines.contains_key(&"mows-core-secrets-vrc-sys/".to_string()) {
            vaultrs::sys::auth::enable(
                &vault_client,
                "mows-core-secrets-vrc-sys",
                "kubernetes",
                None,
            )
            .await
            .context("Failed to create vrc kubernetes auth engine in Vault")?;
        }

        let kube_api_addr = "https://kubernetes.default.svc";

        let kubeconfig_yaml: Value =
            serde_yaml::from_str(some_or_bail!(&cluster.kubeconfig, "Missing kubeconfig"))?;

        let kubernetes_ca_cert_base64 = some_or_bail!(
            kubeconfig_yaml["clusters"][0]["cluster"]["certificate-authority-data"].as_str(),
            "Missing certificate-authority-data"
        );

        let kubernetes_ca_cert =
            String::from_utf8(data_encoding::BASE64.decode(kubernetes_ca_cert_base64.as_bytes())?)?;

        vaultrs::auth::kubernetes::configure(
            &vault_client,
            "mows-core-secrets-vrc-sys",
            kube_api_addr,
            Some(
                &mut ConfigureKubernetesAuthRequestBuilder::default()
                    .kubernetes_ca_cert(kubernetes_ca_cert),
            ),
        )
        .await
        .context("Failed to configure kubernetes auth for vrc in Vault")?;

        vaultrs::sys::policy::set(
            &vault_client,
            "mows-core-secrets-vrc",
            r#"# creating of secret engines
path "sys/mounts/mows-core-secrets-vrc/*" {
  capabilities = ["create","update"]
}

# listing secret engines
path "mows-core-secrets-vrc/*" {
  capabilities = [ "read"]
}
path "sys/mounts" {
  capabilities = [ "read"]
}

# listing auth engines
path "sys/auth" {
  capabilities = [ "read"]
}

# creating auth engines
path "sys/auth/mows-core-secrets-vrc/*" {
  capabilities = ["create", "update","sudo"]
}

# create and list policies
path "sys/policy/mows-core-secrets-vrc/*" {
  capabilities = ["create","update"]
}
path "sys/policy" {
  capabilities = ["list","read"]
}

# give full access to all own engines
path "auth/mows-core-secrets-vrc/*" {
  capabilities = ["list","read","create","update"]
}

path "mows-core-secrets-vrc/*" {
  capabilities = ["list","read","create","update"]
}
"#,
        )
        .await
        .context("Failed to create policy for vrc in Vault")?;

        vaultrs::auth::kubernetes::role::create(
            &vault_client,
            "mows-core-secrets-vrc-sys",
            "mows-core-secrets-vrc",
            Some(
                &mut CreateKubernetesRoleRequestBuilder::default()
                    .bound_service_account_names(vec![s!("mows-core-secrets-vrc")])
                    .bound_service_account_namespaces(vec![s!("mows-core-secrets-vrc")])
                    .token_policies(vec![s!("mows-core-secrets-vrc")]),
            ),
        )
        .await
        .context("Failed to create role for vrc in Vault")?;

        debug!("Vault Resource Controller was created");

        Ok(())
    }

    pub async fn is_vault_sealed(cluster: &Cluster) -> anyhow::Result<bool> {
        let vault_secrets = some_or_bail!(&cluster.vault_secrets, "Vault secrets not found");

        let vault_client = Self::new_vault_client(Some(&vault_secrets.root_token))
            .await
            .context("Failed to create vault client with root token for setting up vrc")?;

        let status = sys::status(&vault_client)
            .await
            .context("Failed to get vault status")?;

        Ok(format!("{:?}", status).contains("SEALED"))
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
