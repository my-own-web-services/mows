use crate::{config::config, resource_types::ClientDataTargetVault, ControllerError};
use mows_common_rust::{
    get_current_config_cloned,
    vault::{ManagedVaultClient, VaultAuthMethod, VaultConfig},
};
use tracing::instrument;

use super::super::config::VaultAuthMethodConfig;

/// Validate that a path component does not contain traversal sequences or slashes.
fn validate_path_component(component: &str, field_name: &str) -> Result<(), ControllerError> {
    if component.contains("..") || component.contains('/') || component.contains('\\') {
        return Err(ControllerError::GenericError(format!(
            "Invalid characters in {}: '{}' must not contain '..', '/' or '\\'",
            field_name, component
        )));
    }
    if component.is_empty() {
        return Err(ControllerError::GenericError(format!(
            "{} must not be empty",
            field_name
        )));
    }
    Ok(())
}

#[instrument(level = "trace", skip(data))]
pub async fn handle_vault_target(
    vault_target: &ClientDataTargetVault,
    resource_scope: &str,
    data: serde_json::Value,
) -> Result<(), ControllerError> {
    validate_path_component(resource_scope, "resource_scope")?;
    validate_path_component(
        &vault_target.kubernetes_auth_engine_name,
        "kubernetes_auth_engine_name",
    )?;
    validate_path_component(&vault_target.secret_engine_name, "secret_engine_name")?;
    validate_path_component(
        &vault_target.secret_engine_sub_path,
        "secret_engine_sub_path",
    )?;

    let config = get_current_config_cloned!(config());

    let auth_role = "zitadel-resource-controller";
    let auth_path = format!(
        "mows-core-secrets-vrc/{}/{}",
        resource_scope, vault_target.kubernetes_auth_engine_name
    );
    let (vault_client, managed_client) =
        create_vault_client(&auth_path, auth_role, &config.vault_auth_method, &config.vault_token)
            .await?;

    let mount_path = format!(
        "mows-core-secrets-vrc/{}/{}",
        resource_scope, vault_target.secret_engine_name
    );

    let result: Result<(), ControllerError> = vaultrs::kv2::set(
        &vault_client,
        &mount_path,
        &vault_target.secret_engine_sub_path,
        &data,
    )
    .await
    .map(|_| ())
    .map_err(ControllerError::from);

    // Revoke the token to prevent lease accumulation
    if let Err(e) = managed_client.revoke_token().await {
        tracing::warn!("Failed to revoke vault token: {}", e);
    }

    result
}

#[instrument(level = "trace", skip(vault_token))]
pub async fn create_vault_client(
    auth_path: &str,
    auth_role: &str,
    vault_auth_method: &VaultAuthMethodConfig,
    vault_token: &Option<String>,
) -> Result<(vaultrs::client::VaultClient, ManagedVaultClient), ControllerError> {
    let config = get_current_config_cloned!(config());

    let auth_method = match vault_auth_method {
        VaultAuthMethodConfig::Kubernetes => VaultAuthMethod::Kubernetes {
            service_account_token_path: config.service_account_token_path,
            auth_path: auth_path.to_string(),
            auth_role: auth_role.to_string(),
        },
        VaultAuthMethodConfig::Token => {
            let token = vault_token.as_deref().unwrap_or("");
            if token.is_empty() {
                return Err(ControllerError::GenericError(
                    "VAULT_TOKEN must be set and non-empty when vault_auth_method is 'token'"
                        .to_string(),
                ));
            }
            VaultAuthMethod::Token {
                token: token.to_string(),
            }
        }
    };

    let vault_config = VaultConfig {
        address: config.vault_url,
        auth_method,
        renewal_threshold: 0.8,
    };

    let managed_client = ManagedVaultClient::new(vault_config).await.map_err(|e| {
        ControllerError::GenericError(format!("Failed to create managed vault client: {}", e))
    })?;

    let vault_client = managed_client.get_client().await.map_err(|e| {
        ControllerError::GenericError(format!("Failed to get vault client: {}", e))
    })?;

    Ok((vault_client, managed_client))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_path_component_rejects_traversal() {
        assert!(validate_path_component("../admin", "test").is_err());
        assert!(validate_path_component("foo/../bar", "test").is_err());
        assert!(validate_path_component("foo/bar", "test").is_err());
        assert!(validate_path_component("foo\\bar", "test").is_err());
    }

    #[test]
    fn test_validate_path_component_rejects_empty() {
        assert!(validate_path_component("", "test").is_err());
    }

    #[test]
    fn test_validate_path_component_accepts_valid() {
        assert!(validate_path_component("my-engine", "test").is_ok());
        assert!(validate_path_component("secret_engine_v2", "test").is_ok());
        assert!(validate_path_component("mows-core-auth", "test").is_ok());
    }
}
