use std::sync::Arc;

use anyhow::Context;
use serde_variant::to_variant_name;
use vaultrs::client::{VaultClient, VaultClientSettingsBuilder};

use crate::VaultResource;

pub async fn create_vault_client() -> anyhow::Result<VaultClient> {
    let mut client_builder = VaultClientSettingsBuilder::default();

    client_builder.address("http://mows-core-secrets-vault-active.mows-core-secrets-vault:8200");

    let vc = VaultClient::new(client_builder.build().context("Failed to create vault client")?)?;

    let service_account_jwt = std::fs::read_to_string("/var/run/secrets/kubernetes.io/serviceaccount/token")
        .context("Failed to read service account token")?;

    let vault_auth = vaultrs::auth::kubernetes::login(
        &vc,
        "mows-core-secrets-vrc",
        "mows-core-secrets-vrc",
        &service_account_jwt,
    )
    .await?;

    let vc = VaultClient::new(
        client_builder
            .token(&vault_auth.client_token)
            .build()
            .context("Failed to create vault client")?,
    )?;

    dbg!(&vault_auth.client_token);

    //vc.settings.token = vault_auth.client_token;

    Ok(vc)
}

pub async fn reconcile_resource(vault_resource: &VaultResource) -> anyhow::Result<()> {
    let vc = create_vault_client()
        .await
        .context("Failed to create vault client")?;

    Ok(())
}
