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
    pub vault_kubernetes_auth_path: String,
    pub vault_kubernetes_auth_role: String,
    pub zitadel_endpoint: String,
    pub zitadel_service_account_token: String,
    pub reconcile_interval_seconds: u64,
}

pub fn from_env() -> anyhow::Result<ControllerConfig> {
    Ok(ControllerConfig {
        vault_uri: load_env(
            "http://mows-core-secrets-vault.mows-core-secrets-vault:8200",
            "VAULT_URI",
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
            "mows-core-secrets-vrc/mows-core-auth-zitadel/zitadel-controller-kubernetes-auth-engine",
            "VAULT_KUBERNETES_AUTH_PATH",
            false,
            true,
        )?,
        vault_kubernetes_auth_role: load_env(
            "mows-core-auth-zitadel-controller",
            "VAULT_KUBERNETES_API_AUTH_ROLE",
            false,
            true,
        )?,
        zitadel_endpoint: load_env("https://zitadel", "ZITADEL_API_ENDPOINT", false, true)?,
        reconcile_interval_seconds: load_env("30", "RECONCILE_INTERVAL", false, true)?.parse()?,
        zitadel_service_account_token: load_env("", "ZITADEL_SERVICE_ACCOUNT_TOKEN", true, true)?,
    })
}
