use mows_common::config::load_env;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::sync::RwLock;

pub fn config() -> &'static RwLock<ControllerConfig> {
    static CONFIG: OnceLock<RwLock<ControllerConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ControllerConfig {
    pub vault_url: String,
    pub service_account_token_path: String,
    pub vault_kubernetes_auth_path: String,
    pub vault_kubernetes_auth_role: String,
    pub reconcile_interval_seconds: u64,
}

pub fn from_env() -> anyhow::Result<ControllerConfig> {
    Ok(ControllerConfig {
        vault_url: load_env(
            "http://vault.mows-core-secrets-vault:8200",
            "VAULT_URL",
            false,
            true,
        )?,
        service_account_token_path: load_env(
            "/var/run/secrets/kubernetes.io/serviceaccount/token",
            "SERVICE_ACCOUNT_TOKEN_PATH",
            false,
            true,
        )?,
        vault_kubernetes_auth_path: load_env(
            "mows-core-secrets-vrc-sys",
            "VAULT_KUBERNETES_AUTH_PATH",
            false,
            true,
        )?,
        vault_kubernetes_auth_role: load_env(
            "mows-core-secrets-vrc",
            "VAULT_KUBERNETES_API_AUTH_ROLE",
            false,
            true,
        )?,
        reconcile_interval_seconds: load_env("30", "RECONCILE_INTERVAL", false, true)?.parse()?,
    })
}
