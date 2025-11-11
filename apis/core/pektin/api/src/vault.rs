use anyhow::Context;
use data_encoding::BASE64;
use lazy_static::lazy_static;
use moka::future::Cache;
use p256::ecdsa::Signature;
use pektin_common::proto::rr::{dnssec::TBS, Name};
use reqwest::{self};
use serde::Deserialize;
use std::path::Path;
use std::str;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{collections::HashMap, time::Duration};
use tracing::{debug, instrument};
use vaultrs::api::transit::requests::{
    CreateKeyRequest, CreateKeyRequestBuilder, SignDataRequestBuilder,
};
use vaultrs::api::transit::{HashAlgorithm, KeyType};
use vaultrs::api::AuthInfo;
use vaultrs::client::{VaultClient, VaultClientSettingsBuilder};
use mows_common_rust::vault::ManagedVaultClient;

use crate::get_current_config_cloned;
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

#[instrument(skip(vault_token))]
pub async fn create_signer_if_not_existent(zone: &Name, vault_token: &str) -> PektinApiResult<()> {
    let api_config = get_current_config_cloned!();

    let (vault_client, managed_client) = create_vault_client_with_token(vault_token).await?;

    let crypto_key_name = get_crypto_key_name_from_zone(&zone);

    // check first if the signer exists in vault if not create it

    let signer_res = vaultrs::transit::key::read(
        &vault_client,
        &api_config.vault_signing_secret_mount_path,
        &crypto_key_name,
    )
    .await;

    let result = if signer_res.is_err() {
        let mut create_key_request_builder = CreateKeyRequestBuilder::default();
        create_key_request_builder
            .key_type(KeyType::EcdsaP256)
            .exportable(false);

        vaultrs::transit::key::create(
            &vault_client,
            &api_config.vault_signing_secret_mount_path,
            &crypto_key_name,
            Some(&mut create_key_request_builder),
        )
        .await
        .map(|_| ())
        .map_err(|e| e.into())
    } else {
        Ok(())
    };

    // Revoke token to prevent lease accumulation
    if let Err(e) = managed_client.revoke_token().await {
        tracing::warn!("Failed to revoke vault token: {}", e);
    }

    result
}

pub fn get_crypto_key_name_from_zone(zone: &Name) -> String {
    let zone = zone.to_string();
    let zone = deabsolute(&zone);
    let zone = idna::domain_to_ascii(zone).expect("Failed to encode");
    format!("{zone}-zsk")
}

/// returns all keys for the zone in PEM format, sorted in the order of their index in the vault response
///
/// you probably want to use the last of the returned keys
#[instrument(skip(vault_token))]
pub async fn get_zone_dnssec_keys(zone: &Name, vault_token: &str) -> PektinApiResult<Vec<String>> {
    let api_config = get_current_config_cloned!();
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

    let crypto_key_name = get_crypto_key_name_from_zone(&zone);

    let target_path = Path::new(&api_config.vault_url)
        .join("v1")
        .join(&api_config.vault_signing_secret_mount_path)
        .join("keys")
        .join(&crypto_key_name);

    let target_path_str = target_path.to_str().ok_or(PektinApiError::GenericError(
        "Failed to convert path to string".to_string(),
    ))?;

    let vault_res = reqwest::Client::new()
        .get(target_path_str)
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
#[instrument(skip(to_be_signed, vault_client))]
pub async fn sign_with_vault(
    to_be_signed: &TBS,
    zone: &Name,
    vault_client: &VaultClient,
) -> PektinApiResult<Vec<u8>> {
    let api_config = get_current_config_cloned!();
    let crypto_key_name = get_crypto_key_name_from_zone(&zone);
    let to_be_signed_base64 = BASE64.encode(to_be_signed.as_ref());

    let mut sign_data_request_builder = SignDataRequestBuilder::default();
    sign_data_request_builder.hash_algorithm(HashAlgorithm::Sha2_256);

    let vault_res = vaultrs::transit::data::sign(
        vault_client,
        &api_config.vault_signing_secret_mount_path,
        &crypto_key_name,
        &to_be_signed_base64,
        Some(&mut sign_data_request_builder),
    )
    .await?;

    debug!("Signing response: {}", vault_res.signature);

    // each signature from vault starts with "vault:v1:", which we don't want
    let sig_bytes = BASE64.decode(&vault_res.signature.as_bytes()[9..])?;

    // vault returns the signature encoded as ASN.1 DER, but we want the raw encoded point
    // coordinates
    // TODO: create issue for vault as this is currently undocumented (I had to look at the source code)
    let sig = Signature::from_der(&sig_bytes).map_err(|_| PektinApiError::InvalidSigFromVault)?;
    Ok(sig.to_vec())
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
    pub async fn get() -> PektinApiResult<String> {
        lazy_static! {
            static ref TOKEN_CACHE: Cache<String, ApiToken> =
                Cache::builder().max_capacity(1).build();
        }

        let token_key = "token";

        if let Some(token) = TOKEN_CACHE.get(&token_key.to_string()).await {
            let current_time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            if token.leased_until_timestamp > current_time {
                return Ok(token.client_token);
            }
        }

        let token = Self::get_token_from_vault().await?;
        TOKEN_CACHE.insert(token_key.to_string(), token.clone());
        Ok(token.client_token)
    }

    async fn get_token_from_vault() -> PektinApiResult<ApiToken> {
        let login_res = vault_k8s_login().await?;

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(ApiToken {
            client_token: login_res.client_token,
            renewable: login_res.renewable,
            leased_until_timestamp: current_time + login_res.lease_duration,
        })
    }
}

pub async fn vault_k8s_login() -> PektinApiResult<AuthInfo> {
    let api_config = get_current_config_cloned!();
    let mut client_builder = VaultClientSettingsBuilder::default();

    client_builder.address(api_config.vault_url.clone());

    let vc = VaultClient::new(client_builder.build().map_err(|_| {
        PektinApiError::GenericError("Failed to create vault client settings builder".to_string())
    })?)?;

    let service_account_jwt =
        std::fs::read_to_string(api_config.service_account_token_path.clone()).map_err(|_| {
            PektinApiError::GenericError("Failed to read service account token".to_string())
        })?;

    let vault_auth = vaultrs::auth::kubernetes::login(
        &vc,
        &api_config.vault_kubernetes_auth_path.clone(),
        &api_config.vault_kubernetes_auth_role.clone(),
        &service_account_jwt,
    )
    .await?;

    Ok(vault_auth)
}

/// Create a managed vault client with K8s login
///
/// Returns both the VaultClient and ManagedVaultClient. Call `revoke_token()` on
/// the managed client when done to prevent lease accumulation.
pub async fn create_vault_client_with_k8s_login() -> Result<(VaultClient, ManagedVaultClient), PektinApiError> {
    use mows_common_rust::vault::{ManagedVaultClient, VaultAuthMethod, VaultConfig};

    let api_config = get_current_config_cloned!();

    let vault_config = VaultConfig {
        address: api_config.vault_url.clone(),
        auth_method: VaultAuthMethod::Kubernetes {
            service_account_token_path: api_config.service_account_token_path.clone(),
            auth_path: api_config.vault_kubernetes_auth_path.clone(),
            auth_role: api_config.vault_kubernetes_auth_role.clone(),
        },
        renewal_threshold: 0.8,
    };

    let managed_client = ManagedVaultClient::new(vault_config)
        .await
        .map_err(|e| PektinApiError::GenericError(format!("Failed to create managed vault client: {}", e)))?;

    let client = managed_client
        .get_client()
        .await
        .map_err(|e| PektinApiError::GenericError(format!("Failed to get vault client: {}", e)))?;

    // Return both client and managed client so token can be revoked after use
    Ok((client, managed_client))
}

/// Create a managed vault client with an existing token
///
/// Returns both the VaultClient and ManagedVaultClient. Call `revoke_token()` on
/// the managed client when done to prevent lease accumulation.
pub async fn create_vault_client_with_token(token: &str) -> Result<(VaultClient, ManagedVaultClient), PektinApiError> {
    use mows_common_rust::vault::{ManagedVaultClient, VaultAuthMethod, VaultConfig};

    let api_config = get_current_config_cloned!();

    let vault_config = VaultConfig {
        address: api_config.vault_url.clone(),
        auth_method: VaultAuthMethod::Token {
            token: token.to_string(),
        },
        renewal_threshold: 0.8,
    };

    let managed_client = ManagedVaultClient::new(vault_config)
        .await
        .map_err(|e| PektinApiError::GenericError(format!("Failed to create managed vault client: {}", e)))?;

    let client = managed_client
        .get_client()
        .await
        .map_err(|e| PektinApiError::GenericError(format!("Failed to get vault client: {}", e)))?;

    // Return both client and managed client so token can be revoked after use
    Ok((client, managed_client))
}
