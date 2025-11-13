use crate::get_current_config_cloned;
use crate::{
    errors_and_responses::{PektinApiError, PektinApiResult},
    utils::{deabsolute, prettify_json},
};
use data_encoding::BASE64;
use mows_common_rust::vault::ManagedVaultClient;
use p256::ecdsa::Signature;
use pektin_common::proto::rr::{dnssec::TBS, Name};
use reqwest::{self};
use serde::Deserialize;
use std::str;
use std::{collections::HashMap, time::Duration};
use tracing::{debug, instrument};
use vaultrs::api::transit::requests::{CreateKeyRequestBuilder, SignDataRequestBuilder};
use vaultrs::api::transit::{HashAlgorithm, KeyType};
use vaultrs::client::VaultClient;

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

#[instrument(skip(managed_vault_client))]
pub async fn create_signer_if_not_existent(
    zone: &Name,
    managed_vault_client: &ManagedVaultClient,
) -> PektinApiResult<()> {
    let api_config = get_current_config_cloned!();

    let vault_client = managed_vault_client
        .get_client()
        .await
        .map_err(|e| PektinApiError::GenericError(format!("Failed to get vault client: {}", e)))?;

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
#[instrument(skip(managed_vault_client))]
pub async fn get_zone_dnssec_keys(
    zone: &Name,
    managed_vault_client: &ManagedVaultClient,
) -> PektinApiResult<Vec<String>> {
    let vault_client = managed_vault_client
        .get_client()
        .await
        .map_err(|e| PektinApiError::GenericError(format!("Failed to get vault client: {}", e)))?;

    let api_config = get_current_config_cloned!();

    let crypto_key_name = get_crypto_key_name_from_zone(&zone);

    let key_response = vaultrs::transit::key::read(
        &vault_client,
        &api_config.vault_signing_secret_mount_path,
        &crypto_key_name,
    )
    .await?;

    let keys_map = match key_response.keys {
        vaultrs::api::transit::responses::ReadKeyData::Asymmetric(keys) => keys,
        vaultrs::api::transit::responses::ReadKeyData::Symmetric(_) => {
            return Err(PektinApiError::GenericError(
                "Expected asymmetric key but got symmetric key".to_string(),
            ))
        }
    };

    let mut keys_with_index: Vec<_> = keys_map
        .into_iter()
        .map(|(index, key_info)| {
            (
                index
                    .parse::<usize>()
                    .expect("vault key index was not a number"),
                key_info.public_key,
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
#[instrument(skip(to_be_signed, managed_vault_client))]
pub async fn sign_with_vault(
    to_be_signed: &TBS,
    zone: &Name,
    managed_vault_client: &ManagedVaultClient,
) -> PektinApiResult<Vec<u8>> {
    let api_config = get_current_config_cloned!();
    let crypto_key_name = get_crypto_key_name_from_zone(&zone);
    let to_be_signed_base64 = BASE64.encode(to_be_signed.as_ref());

    let mut sign_data_request_builder = SignDataRequestBuilder::default();
    sign_data_request_builder.hash_algorithm(HashAlgorithm::Sha2_256);

    let vault_client = managed_vault_client
        .get_client()
        .await
        .map_err(|e| PektinApiError::GenericError(format!("Could not get vault client: {}", e)))?;

    let vault_res = vaultrs::transit::data::sign(
        &vault_client,
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

/// Create a managed vault client with K8s login
///
/// Returns both the VaultClient and ManagedVaultClient. Call `revoke_token()` on
/// the managed client when done to prevent lease accumulation.
pub async fn create_vault_client_with_k8s_login(
) -> Result<(VaultClient, ManagedVaultClient), PektinApiError> {
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

    let managed_client = ManagedVaultClient::new(vault_config).await.map_err(|e| {
        PektinApiError::GenericError(format!("Failed to create managed vault client: {}", e))
    })?;

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
pub async fn create_vault_client_with_token(
    token: &str,
) -> Result<(VaultClient, ManagedVaultClient), PektinApiError> {
    use mows_common_rust::vault::{ManagedVaultClient, VaultAuthMethod, VaultConfig};

    let api_config = get_current_config_cloned!();

    let vault_config = VaultConfig {
        address: api_config.vault_url.clone(),
        auth_method: VaultAuthMethod::Token {
            token: token.to_string(),
        },
        renewal_threshold: 0.8,
    };

    let managed_client = ManagedVaultClient::new(vault_config).await.map_err(|e| {
        PektinApiError::GenericError(format!("Failed to create managed vault client: {}", e))
    })?;

    let client = managed_client
        .get_client()
        .await
        .map_err(|e| PektinApiError::GenericError(format!("Failed to get vault client: {}", e)))?;

    // Return both client and managed client so token can be revoked after use
    Ok((client, managed_client))
}
