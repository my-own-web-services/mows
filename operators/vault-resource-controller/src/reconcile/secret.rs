use anyhow::Context;
use serde_variant::to_variant_name;
use vaultrs::client::VaultClient;

use crate::{KV2SecretEngineParams, VaultSecretEngine};

pub async fn handle_secret_engine(
    vault_client: &VaultClient,
    resource_namespace: &str,
    resource_name: &str,
    vault_secret_engine: &VaultSecretEngine,
) -> anyhow::Result<()> {
    let mount_path = format!("mows-core-secrets-vrc/{}/{}", resource_namespace, resource_name);

    let current_secret_engines = vaultrs::sys::mount::list(vault_client)
        .await
        .context("Failed to list secret engines in Vault")?;

    if current_secret_engines.contains_key(&format!("{mount_path}/")) {
        return Ok(());
    }

    vaultrs::sys::mount::enable(
        vault_client,
        &mount_path,
        &to_variant_name(&vault_secret_engine).unwrap(),
        None,
    )
    .await
    .context(format!("Failed to create secret engine {mount_path} in Vault"))?;

    match &vault_secret_engine {
        VaultSecretEngine::KV2(kv2_secret_engine_params) => {
            handle_kv2_engine(vault_client, &mount_path, kv2_secret_engine_params).await?
        }
        VaultSecretEngine::Transit(_) => {}
    }

    Ok(())
}

pub async fn handle_kv2_engine(
    vault_client: &VaultClient,
    mount_path: &str,
    kv2_secret_engine_params: &KV2SecretEngineParams,
) -> anyhow::Result<()> {
    for secret in kv2_secret_engine_params.kv_data.iter() {
        vaultrs::kv2::set(vault_client, mount_path, &secret.0, &secret.1)
            .await
            .context(format!("Failed to create secret {} in Vault", secret.0))?;
    }

    Ok(())
}
