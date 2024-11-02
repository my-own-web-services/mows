use std::time::Duration;

use anyhow::{bail, Context};
use serde::Deserialize;
use serde_json::{json, Value};
use tracing::debug;
use vaultrs::{
    api::AuthInfo,
    client::{VaultClient, VaultClientSettingsBuilder},
};

use crate::{get_current_config_cloned, types::VaultCert};

pub async fn get_kv_value(
    endpoint: &str,
    token: &str,
    kv_engine: &str,
    key: &str,
) -> anyhow::Result<Value> {
    #[derive(Deserialize, Debug)]
    struct VaultRes {
        data: VaultData,
    }
    #[derive(Deserialize, Debug)]
    struct VaultData {
        data: Value,
    }

    let url = format!("{endpoint}/v1/{kv_engine}/data/{key}");
    let vault_res = reqwest::Client::new()
        .get(url)
        .timeout(Duration::from_secs(2))
        .header("X-Vault-Token", token)
        .send()
        .await?;

    let vault_res_text = vault_res.text().await?;
    let vault_res: VaultRes = match serde_json::from_str(&vault_res_text) {
        Ok(vault_res) => vault_res,
        Err(err) => bail!("Failed to parse VaultRes while getting kv pair for key: {key} {err}"),
    };

    let value = vault_res.data.data;

    Ok(value)
}

pub async fn update_kv_value(
    endpoint: &str,
    token: &str,
    kv_engine: &str,
    key: &str,
    value: &VaultCert,
) -> anyhow::Result<()> {
    // delete the key first
    let del_req = reqwest::Client::new()
        .delete(format!("{endpoint}/v1/{kv_engine}/metadata/{key}"))
        .timeout(Duration::from_secs(2))
        .header("X-Vault-Token", token)
        .send()
        .await?;

    if !del_req.status().is_success() {
        bail!("failed to delete key");
    }

    let set_req = reqwest::Client::new()
        .post(format!("{endpoint}/v1/{kv_engine}/data/{key}"))
        .timeout(Duration::from_secs(2))
        .body(serde_json::json!({ "data": value }).to_string())
        .header("X-Vault-Token", token)
        .send()
        .await?;

    if !set_req.status().is_success() {
        bail!("failed to set key");
    }

    Ok(())
}

pub async fn vault_k8s_login() -> anyhow::Result<AuthInfo> {
    let api_config = get_current_config_cloned!();
    let mut client_builder = VaultClientSettingsBuilder::default();

    client_builder.address(api_config.vault_uri.clone());

    let vc = VaultClient::new(
        client_builder
            .build()
            .context("Failed to create vault client")?,
    )?;

    let service_account_jwt =
        std::fs::read_to_string(api_config.service_account_token_path.clone())
            .context("Failed to read service account token file")?;

    let vault_auth = vaultrs::auth::kubernetes::login(
        &vc,
        &api_config.vault_kubernetes_auth_path.clone(),
        &api_config.vault_kubernetes_auth_role.clone(),
        &service_account_jwt,
    )
    .await?;

    Ok(vault_auth)
}

pub async fn create_vault_client() -> anyhow::Result<VaultClient> {
    let api_config = get_current_config_cloned!();

    let mut client_builder = VaultClientSettingsBuilder::default();

    client_builder.address(api_config.vault_uri.clone());

    let vc = VaultClient::new(
        client_builder
            .token(vault_k8s_login().await?.client_token)
            .build()
            .context("Failed to create vault client")?,
    )?;

    Ok(vc)
}
