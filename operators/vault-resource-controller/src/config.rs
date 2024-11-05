use std::sync::OnceLock;

use pektin_common::load_env;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

pub fn config() -> &'static RwLock<ControllerConfig> {
    static API_CONFIG: OnceLock<RwLock<ControllerConfig>> = OnceLock::new();
    API_CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ControllerConfig {
    pub vault_uri: String,
    pub service_account_token_path: String,
    pub vault_kubernetes_auth_path: String,
    pub vault_kubernetes_auth_role: String,
}

pub fn from_env() -> anyhow::Result<ControllerConfig> {
    Ok(ControllerConfig {
        vault_uri: load_env(
            "http://mows-core-secrets-vault.mows-core-secrets-vault:8200",
            "VAULT_URI",
            false,
        )?,
        service_account_token_path: load_env(
            "/var/run/secrets/kubernetes.io/serviceaccount/token",
            "SERVICE_ACCOUNT_TOKEN_PATH",
            false,
        )?,

        vault_kubernetes_auth_path: load_env(
            "mows-core-secrets-vrc-sys",
            "VAULT_KUBERNETES_AUTH_PATH",
            false,
        )?,
        vault_kubernetes_auth_role: load_env(
            "mows-core-secrets-vrc",
            "VAULT_KUBERNETES_API_AUTH_ROLE",
            false,
        )?,
    })
}
