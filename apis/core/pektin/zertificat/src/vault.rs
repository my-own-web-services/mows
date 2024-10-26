use std::time::Duration;

use anyhow::bail;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::types::VaultCert;

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

// get the vault access token with role and secret id
pub async fn login_userpass(
    endpoint: &str,
    username: &str,
    password: &str,
) -> anyhow::Result<String> {
    #[derive(Deserialize, Debug)]
    pub struct VaultRes {
        auth: VaultAuth,
    }
    #[derive(Deserialize, Debug)]
    pub struct VaultAuth {
        client_token: String,
    }

    let vault_res = reqwest::Client::new()
        .post(format!("{endpoint}/v1/auth/userpass/login/{username}"))
        .timeout(Duration::from_secs(2))
        .body(
            json!({
                "password": password,
            })
            .to_string(),
        )
        .send()
        .await?;
    let vault_res = vault_res.text().await?;

    let vault_res: VaultRes = match serde_json::from_str(&vault_res) {
        Ok(vault_res) => vault_res,
        Err(err) => bail!("Failed to parse VaultRes while logging into account: {username} {err}"),
    };
    Ok(vault_res.auth.client_token)
}
