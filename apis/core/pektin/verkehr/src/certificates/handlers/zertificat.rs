use crate::utils::strings_to_certified_key;
use anyhow::bail;
use rustls::sign::CertifiedKey;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashMap, sync::Arc, time::Duration};

pub async fn get_certificates(
) -> anyhow::Result<HashMap<String, (Arc<CertifiedKey>, VaultCertInfo)>> {
    let zertificat_auth = get_zertificat_consumer_auth()?;

    let token = login_userpass(
        &zertificat_auth.vault_url,
        &zertificat_auth.username,
        &zertificat_auth.password,
    )
    .await?;

    let list = list_kv(&zertificat_auth.vault_url, &token, "pektin-zertificat").await?;

    let mut certs = HashMap::new();
    for domain in list {
        let cert = get_zertificate(&zertificat_auth.vault_url, &token, &domain).await?;
        certs.insert(domain, cert);
    }
    Ok(certs)
}

pub async fn get_zertificate(
    vault_url: &str,
    token: &str,
    domain: &str,
) -> anyhow::Result<(Arc<CertifiedKey>, VaultCertInfo)> {
    let val = get_kv_value(vault_url, token, "pektin-zertificat", domain).await?;
    let vault_cert: VaultCert = serde_json::from_value(val)?;
    let cert = strings_to_certified_key(&vault_cert.cert, &vault_cert.key)?;
    Ok((Arc::new(cert), vault_cert.info))
}

pub fn get_zertificat_consumer_auth() -> anyhow::Result<ZertificatConsumerAuth> {
    let env = std::env::vars();
    let mut vault_url: Option<String> = None;
    let mut username: Option<String> = None;
    let mut password: Option<String> = None;
    for (k, v) in env {
        if k == "VAULT_URL" {
            vault_url = Some(v);
        } else if k == "ZERTIFICAT_CONSUMER_VAULT_USERNAME" {
            username = Some(v);
        } else if k == "ZERTIFICAT_CONSUMER_VAULT_PASSWORD" {
            password = Some(v);
        }
    }
    if vault_url.is_none() || username.is_none() || password.is_none() {
        bail!("VAULT_URL, USERNAME and PASSWORD must be provided as environment variables");
    }
    Ok(ZertificatConsumerAuth {
        vault_url: vault_url.unwrap(),
        username: username.unwrap(),
        password: password.unwrap(),
    })
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ZertificatConsumerAuth {
    pub username: String,
    pub password: String,
    pub vault_url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VaultCert {
    pub domain: String,
    pub cert: String,
    pub key: String,
    pub info: VaultCertInfo,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VaultCertInfo {
    pub created: i64,
}

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

pub async fn list_kv(endpoint: &str, token: &str, kv_engine: &str) -> anyhow::Result<Vec<String>> {
    #[derive(Deserialize, Debug)]
    struct VaultRes {
        data: VaultData,
    }
    #[derive(Deserialize, Debug)]
    struct VaultData {
        keys: Vec<String>,
    }

    let url = format!("{endpoint}/v1/{kv_engine}/metadata/?list=true");
    let vault_res = reqwest::Client::new()
        .get(url)
        .timeout(Duration::from_secs(2))
        .header("X-Vault-Token", token)
        .send()
        .await?;

    let vault_res_text = vault_res.text().await?;
    let vault_res: VaultRes = match serde_json::from_str(&vault_res_text) {
        Ok(vault_res) => vault_res,
        Err(err) => {
            bail!("Failed to parse VaultRes while listing kv for engine: {kv_engine} {err} {vault_res_text}")
        }
    };

    let keys = vault_res.data.keys;

    Ok(keys)
}

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
