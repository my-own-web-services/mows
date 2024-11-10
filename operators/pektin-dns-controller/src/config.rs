use std::sync::OnceLock;

use mows_common::config::load_env;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

pub fn config() -> &'static RwLock<ControllerConfig> {
    static CONFIG: OnceLock<RwLock<ControllerConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ControllerConfig {
    pub vault_uri: String,
    pub service_account_token_path: String,
    pub vault_kubernetes_api_auth_path: String,
    pub pektin_api_endpoint: String,
    pub pektin_username: String,
    pub reconcile_interval_seconds: u64,
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

        vault_kubernetes_api_auth_path: load_env(
            "mows-core-secrets-vrc/mows-core-dns-pektin/pektin-kubernetes-api-clients",
            "VAULT_KUBERNETES_API_AUTH_PATH",
            false,
        )?,
        pektin_api_endpoint: load_env("http://pektin-api", "PEKTIN_API_ENDPOINT", false)?,
        pektin_username: load_env("pektin-dns-controller", "PEKTIN_USERNAME", false)?,
        reconcile_interval_seconds: load_env("30", "RECONCILE_INTERVAL", false)?.parse()?,
    })
}
