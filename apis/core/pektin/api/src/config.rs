use std::{env, sync::OnceLock};

use anyhow::bail;
use pektin_common::load_env;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::errors_and_responses::PektinApiResult;

pub fn config() -> &'static RwLock<ApiConfig> {
    static API_CONFIG: OnceLock<RwLock<ApiConfig>> = OnceLock::new();
    API_CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

pub fn from_env() -> PektinApiResult<ApiConfig> {
    Ok(ApiConfig {
        bind_address: load_env("::", "BIND_ADDRESS", false)?,
        bind_port: load_env("80", "BIND_PORT", false)?
            .parse()
            .map_err(|_| pektin_common::PektinCommonError::InvalidEnvVar("BIND_PORT".into()))?,
        db_hostname: load_env("pektin-db", "DB_HOSTNAME", false)?,
        db_port: load_env("6379", "DB_PORT", false)?
            .parse()
            .map_err(|_| pektin_common::PektinCommonError::InvalidEnvVar("DB_PORT".into()))?,
        db_username: load_env("pektin-api", "DB_USERNAME", false)?,
        db_password: load_env("", "DB_PASSWORD", true)?,
        vault_uri: load_env(
            "http://mows-core-secrets-vault.mows-core-secrets-vault:8200",
            "VAULT_URI",
            false,
        )?,
        ribston_uri: load_env("http://pektin-ribston:80", "RIBSTON_URI", false)?,

        use_policies: load_env("ribston", "USE_POLICIES", false)?,
        skip_auth: load_env("false", "SKIP_AUTH", false)?,
        policy_vault_path: load_env("", "POLICY_VAULT_PATH", false)?,
        service_account_token_path: load_env(
            "/var/run/secrets/kubernetes.io/serviceaccount/token",
            "SERVICE_ACCOUNT_TOKEN_PATH",
            false,
        )?,
        vault_kubernetes_auth_path: load_env(
            "mows-core-secrets-vrc/mows-core-dns-pektin/pektin-kubernetes",
            "VAULT_KUBERNETES_AUTH_PATH",
            false,
        )?,
        vault_kubernetes_auth_role: load_env("pektin-api", "VAULT_KUBERNETES_AUTH_ROLE", false)?,
        vault_signing_secret_mount_path: load_env(
            "mows-core-secrets-vrc/mows-core-dns-pektin/pektin-signing",
            "VAULT_SIGNER_SECRET_MOUNT_PATH",
            false,
        )?,
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ApiConfig {
    pub bind_address: String,
    pub bind_port: u16,
    pub db_hostname: String,
    pub db_username: String,
    pub db_password: String,
    pub db_port: u16,
    pub vault_uri: String,
    pub ribston_uri: String,
    pub skip_auth: String,
    pub use_policies: String,
    pub service_account_token_path: String,
    pub vault_kubernetes_auth_path: String,
    pub vault_kubernetes_auth_role: String,
    pub policy_vault_path: String,
    pub vault_signing_secret_mount_path: String,
}
