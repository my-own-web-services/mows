use crate::{config::config, crd::ClientDataTargetVault, ControllerError};
use mows_common_rust::{get_current_config_cloned, vault::{ManagedVaultClient, VaultAuthMethod, VaultConfig}};
use tracing::instrument;

#[instrument(level = "trace")]
pub async fn handle_vault_target(
    vault_target: &ClientDataTargetVault,
    resource_namespace: &str,
    data: serde_json::Value,
) -> Result<(), ControllerError> {
    let auth_role = "zitadel-resource-controller";
    let auth_path = format!(
        "mows-core-secrets-vrc/{}/{}",
        resource_namespace, vault_target.kubernetes_auth_engine_name
    );
    let (vault_client, managed_client) = create_vault_client(&auth_path, &auth_role).await?;

    let mount_path = format!(
        "mows-core-secrets-vrc/{}/{}",
        resource_namespace, vault_target.secret_engine_name
    );

    let result = vaultrs::kv2::set(
        &vault_client,
        &mount_path,
        &vault_target.secret_engine_sub_path,
        &data,
    )
    .await
    .map_err(|e| e.into());

    // Revoke the token to prevent lease accumulation
    if let Err(e) = managed_client.revoke_token().await {
        tracing::warn!("Failed to revoke vault token: {}", e);
    }

    result.map(|_| ())
}

#[instrument(level = "trace")]
pub async fn create_vault_client(auth_path: &str, auth_role: &str) -> Result<(vaultrs::client::VaultClient, ManagedVaultClient), ControllerError> {
    let config = get_current_config_cloned!(config());

    let vault_config = VaultConfig {
        address: config.vault_url,
        auth_method: VaultAuthMethod::Kubernetes {
            service_account_token_path: config.service_account_token_path,
            auth_path: auth_path.to_string(),
            auth_role: auth_role.to_string(),
        },
        renewal_threshold: 0.8,
    };

    let managed_client = ManagedVaultClient::new(vault_config)
        .await
        .map_err(|e| ControllerError::GenericError(format!("Failed to create managed vault client: {}", e)))?;

    let vault_client = managed_client
        .get_client()
        .await
        .map_err(|e| ControllerError::GenericError(format!("Failed to get vault client: {}", e)))?;

    // Return both the client and the managed client so the token can be revoked later
    Ok((vault_client, managed_client))
}
