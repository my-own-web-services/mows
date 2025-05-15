use crate::{config::config, crd::ClientDataTargetVault, ControllerError};
use anyhow::Context;
use mows_common_rust::get_current_config_cloned;
use vaultrs::client::{VaultClient, VaultClientSettingsBuilder};

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
    let vault_client = create_vault_client(&auth_path, &auth_role).await?;

    let mount_path = format!(
        "mows-core-secrets-vrc/{}/{}",
        resource_namespace, vault_target.secret_engine_name
    );

    vaultrs::kv2::set(
        &vault_client,
        &mount_path,
        &vault_target.secret_engine_sub_path,
        &data,
    )
    .await?;
    Ok(())
}

pub async fn create_vault_client(auth_path: &str, auth_role: &str) -> Result<VaultClient, ControllerError> {
    let mut client_builder = VaultClientSettingsBuilder::default();

    let config = get_current_config_cloned!(config());

    client_builder.address(config.vault_url);

    let vc = VaultClient::new(client_builder.build().map_err(|_| {
        ControllerError::GenericError("Failed to create vault client settings builder".to_string())
    })?)?;

    let service_account_jwt = std::fs::read_to_string(config.service_account_token_path)
        .context("Failed to read service account token")?;

    let vault_auth =
        vaultrs::auth::kubernetes::login(&vc, auth_path, auth_role, &service_account_jwt).await?;

    let vc = VaultClient::new(
        client_builder
            .token(&vault_auth.client_token)
            .build()
            .context("Failed to create vault client")?,
    )?;

    Ok(vc)
}
