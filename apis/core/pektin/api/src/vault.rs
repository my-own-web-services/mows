use std::{collections::HashMap, time::Duration};

use data_encoding::BASE64;
use lazy_static::lazy_static;
use moka::future::Cache;
use p256::ecdsa::Signature;
use pektin_common::proto::rr::{dnssec::TBS, Name};
use reqwest::{self};
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::str;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, instrument};

use crate::{
    errors_and_responses::{PektinApiError, PektinApiResult},
    utils::{deabsolute, prettify_json},
};

#[instrument(skip(endpoint, token))]
pub async fn get_policy(endpoint: &str, token: &str, policy_name: &str) -> PektinApiResult<String> {
    let val = get_kv_value(endpoint, token, "pektin-policies", policy_name).await?;

    let policy = val
        .get_key_value("ribstonPolicy")
        .ok_or(PektinApiError::GetRibstonPolicy)?
        .1
        .to_string();

    debug!("Got policy {policy_name}: {policy}");
    Ok(policy)
}

#[instrument(skip(endpoint, token))]
pub async fn get_kv_value(
    endpoint: &str,
    token: &str,
    kv_engine: &str,
    key: &str,
) -> PektinApiResult<HashMap<String, String>> {
    #[derive(Deserialize, Debug)]
    struct VaultRes {
        data: VaultData,
    }
    #[derive(Deserialize, Debug)]
    struct VaultData {
        data: HashMap<String, String>,
    }

    let url = format!("{endpoint}/v1/{kv_engine}/data/{key}");
    let vault_res = reqwest::Client::new()
        .get(url)
        .timeout(Duration::from_secs(2))
        .header("X-Vault-Token", token)
        .send()
        .await?;
    let vault_res = vault_res.text().await?;
    debug!("Key value response: {}", prettify_json(&vault_res));
    let vault_res: VaultRes = serde_json::from_str(&vault_res)?;

    let value = vault_res.data.data;
    debug!("Value for key {} is {:?}", key, value);

    Ok(value)
}

#[derive(Deserialize, Debug)]
pub struct VaultRes {
    auth: VaultAuth,
}
#[derive(Deserialize, Debug)]
pub struct VaultAuth {
    client_token: String,
    lease_duration: u64,
    renewable: bool,
}

// get the vault access token with role and secret id
#[instrument(skip(endpoint, password))]
pub async fn login_userpass(
    endpoint: &str,
    username: &str,
    password: &str,
) -> PektinApiResult<String> {
    let vault_res = reqwest::Client::new()
        .post(format!("{endpoint}/v1/auth/userpass/login/{username}"))
        .timeout(Duration::from_secs(2))
        .json(&json!({
            "password": password,
        }))
        .send()
        .await?;
    let vault_res = vault_res.text().await?;
    debug!("Login response: {}", prettify_json(&vault_res));

    let vault_res: VaultRes =
        serde_json::from_str(&vault_res).map_err(|_| PektinApiError::InvalidCredentials)?;
    Ok(vault_res.auth.client_token)
}

// get the vault access token with role and secret id
#[instrument(skip(endpoint, password))]
pub async fn login_userpass_return_meta(
    endpoint: &str,
    username: &str,
    password: &str,
) -> PektinApiResult<VaultAuth> {
    let vault_res = reqwest::Client::new()
        .post(format!("{endpoint}/v1/auth/userpass/login/{username}"))
        .timeout(Duration::from_secs(2))
        .json(&json!({
            "password": password,
        }))
        .send()
        .await?;
    let vault_res = vault_res.text().await?;
    debug!("Login response: {}", prettify_json(&vault_res));

    let vault_res: VaultRes =
        serde_json::from_str(&vault_res).map_err(|_| PektinApiError::InvalidCredentials)?;
    Ok(vault_res.auth)
}

#[instrument(skip(uri))]
pub async fn get_health(uri: &str) -> u16 {
    let res = reqwest::Client::new()
        .get(format!("{uri}/v1/sys/health"))
        .timeout(Duration::from_secs(2))
        .send()
        .await;

    let health_code = res.map(|r| r.status().as_u16()).unwrap_or(0);
    debug!("Vault health query returned {health_code}");
    health_code
}

/// returns all keys for the zone in PEM format, sorted in the order of their index in the vault response
///
/// you probably want to use the last of the returned keys
#[instrument(skip(vault_uri, vault_token))]
pub async fn get_zone_dnssec_keys(
    zone: &Name,
    vault_uri: &str,
    vault_token: &str,
) -> PektinApiResult<Vec<String>> {
    #[derive(Deserialize, Debug)]
    struct VaultRes {
        data: VaultData,
    }
    #[derive(Deserialize, Debug)]
    struct VaultData {
        keys: HashMap<String, VaultKey>,
    }
    #[derive(Deserialize, Debug)]
    struct VaultKey {
        /// in PEM format
        public_key: String,
    }
    let crypto_key_type = "zsk";
    let zone = zone.to_string();
    let zone = deabsolute(&zone);
    let zone = idna::domain_to_ascii(zone).expect("Failed to encode");

    let target_url = format!("{vault_uri}/v1/pektin-transit/keys/{zone}-{crypto_key_type}",);
    let vault_res = reqwest::Client::new()
        .get(target_url)
        .timeout(Duration::from_secs(2))
        .header("X-Vault-Token", vault_token)
        .send()
        .await?
        .text()
        .await?;
    debug!("DNSSEC keys response: {}", prettify_json(&vault_res));

    let vault_res = serde_json::from_str::<VaultRes>(&vault_res)?;
    let mut keys_with_index: Vec<_> = vault_res
        .data
        .keys
        .into_iter()
        .map(|(index, key)| {
            (
                index
                    .parse::<usize>()
                    .expect("vault key index was not a number"),
                key.public_key,
            )
        })
        .collect();
    keys_with_index.sort_by_key(|(index, _)| *index);

    let keys = keys_with_index.into_iter().map(|(_, key)| key).collect();
    debug!("DNSSEC keys for zone {}: {:?}", zone, keys);

    Ok(keys)
}

/// take a base64 ([`data_encoding::BASE64`](https://docs.rs/data-encoding/2.3.2/data_encoding/constant.BASE64.html)) record and sign it with vault
/// `zone` SHOULD NOT end with '.', if it does, the trailing '.' will be silently removed
#[instrument(skip(tbs, vault_uri, vault_token))]
pub async fn sign_with_vault(
    tbs: &TBS,
    zone: &Name,
    vault_uri: &str,
    vault_token: &str,
) -> PektinApiResult<Vec<u8>> {
    #[derive(Deserialize, Debug)]
    struct VaultRes {
        data: VaultData,
    }

    // TODO BATCH SIGN
    #[derive(Deserialize, Debug)]
    struct VaultBatchData {
        batch_results: Vec<VaultBatchDataSigWrapper>,
    }
    #[derive(Deserialize, Debug)]
    struct VaultBatchDataSigWrapper {
        signature: String, //this is in base64 with the need to trim off the vault:v1: prefix
    }

    #[derive(Deserialize, Debug)]
    struct VaultData {
        signature: String,
    }
    let crypto_key_type = "zsk";

    let zone = zone.to_string();
    let zone = deabsolute(&zone);
    let zone = idna::domain_to_ascii(zone).expect("Failed to encode");
    let tbs_base64 = BASE64.encode(tbs.as_ref());
    let post_target =
        format!("{vault_uri}/v1/pektin-transit/sign/{zone}-{crypto_key_type}/sha2-256");
    debug!("Posting signing request to vault at {}", post_target);

    let vault_res: String = reqwest::Client::new()
        .post(post_target)
        .timeout(Duration::from_secs(2))
        .header("X-Vault-Token", vault_token)
        .json(&json!({
            "input": tbs_base64,
        }))
        .send()
        .await?
        .text()
        .await?;
    debug!("Signing response: {}", prettify_json(&vault_res));

    let vault_res = serde_json::from_str::<VaultRes>(&vault_res)?;

    // each signature from vault starts with "vault:v1:", which we don't want
    let sig_bytes = BASE64.decode(&vault_res.data.signature.as_bytes()[9..])?;

    // vault returns the signature encoded as ASN.1 DER, but we want the raw encoded point
    // coordinates
    // TODO: create issue for vault as this is currently undocumented (I had to look at the source code)
    let sig = Signature::from_der(&sig_bytes).map_err(|_| PektinApiError::InvalidSigFromVault)?;
    Ok(sig.to_vec())
}

pub struct ClientTokenCache;
impl ClientTokenCache {
    /// # Examples
    /// ```rs
    /// let token = ClientTokenCache::get("http://pektin-vault:80", "username", "password").unwrap();
    /// ```
    pub async fn get(
        endpoint: impl AsRef<str>,
        username: impl AsRef<str>,
        password: impl AsRef<str>,
    ) -> PektinApiResult<String> {
        lazy_static! {
            static ref TOKEN_CACHE: Cache<String, ApiToken> = Cache::builder()
                .max_capacity(1024)
                .time_to_live(Duration::from_secs(5 * 60))
                .build();
        }

        let (username, password) = (username.as_ref(), password.as_ref());

        let mut hasher = Sha256::new();

        hasher.update(format!("{}:{}", username, password));
        let token_key = format!("{:X}", hasher.finalize());

        if let Some(token) = TOKEN_CACHE.get(&token_key).await {
            let current_time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            if token.leased_until_timestamp > current_time {
                return Ok(token.client_token);
            }
        }

        let token = Self::get_token_from_vault(endpoint.as_ref(), username, password).await?;
        TOKEN_CACHE.insert(token_key, token.clone());
        Ok(token.client_token)
    }

    async fn get_token_from_vault(
        endpoint: &str,
        username: &str,
        password: &str,
    ) -> PektinApiResult<ApiToken> {
        let userpass_res = login_userpass_return_meta(endpoint, username, password).await?;

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(ApiToken {
            client_token: userpass_res.client_token,
            renewable: userpass_res.renewable,
            leased_until_timestamp: current_time + userpass_res.lease_duration,
        })
    }
}

pub struct ApiTokenCache;

#[derive(Clone, Debug)]
struct ApiToken {
    client_token: String,
    renewable: bool,
    leased_until_timestamp: u64,
}

impl ApiTokenCache {
    /// # Examples
    /// ```rs
    /// let token = ApiTokenCache::get("http://pektin-vault:80", "username", "password").unwrap();
    /// ```
    pub async fn get(
        endpoint: impl AsRef<str>,
        username: impl AsRef<str>,
        password: impl AsRef<str>,
    ) -> PektinApiResult<String> {
        lazy_static! {
            static ref TOKEN_CACHE: Cache<String, ApiToken> =
                Cache::builder().max_capacity(1).build();
        }

        let (username, password) = (username.as_ref(), password.as_ref());

        let mut hasher = Sha256::new();

        hasher.update(format!("{}:{}", username, password));
        let token_key = format!("{:X}", hasher.finalize());

        if let Some(token) = TOKEN_CACHE.get(&token_key).await {
            let current_time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            if token.leased_until_timestamp > current_time {
                return Ok(token.client_token);
            }
        }

        let token = Self::get_token_from_vault(endpoint.as_ref(), username, password).await?;
        TOKEN_CACHE.insert(token_key, token.clone());
        Ok(token.client_token)
    }

    async fn get_token_from_vault(
        endpoint: &str,
        username: &str,
        password: &str,
    ) -> PektinApiResult<ApiToken> {
        let userpass_res = login_userpass_return_meta(endpoint, username, password).await?;

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(ApiToken {
            client_token: userpass_res.client_token,
            renewable: userpass_res.renewable,
            leased_until_timestamp: current_time + userpass_res.lease_duration,
        })
    }
}
