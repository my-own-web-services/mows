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
    pub zitadel_secrets_engine_name: String,
    pub zitadel_secrets_path: String,
    pub zitadel_endpoint: String,
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

        vault_kubernetes_auth_path: load_env(
            "mows-core-secrets-vrc/mows-core-auth-zitadel/zitadel-controller-kubernetes-auth-engine",
            "VAULT_KUBERNETES_AUTH_PATH",
            false,
        )?,
        vault_kubernetes_auth_role: load_env(
            "mows-core-auth-zitadel-controller",
            "VAULT_KUBERNETES_API_AUTH_ROLE",
            false,
        )?,

        zitadel_endpoint: load_env("http://zitadel", "ZITADEL_API_ENDPOINT", false)?,
        reconcile_interval_seconds: load_env("30", "RECONCILE_INTERVAL", false)?.parse()?,
        zitadel_secrets_engine_name: load_env(
            "mows-core-secrets-vrc/mows-core-auth-zitadel/zitadel-secrets",
            "ZITADEL_SECRETS_ENGINE_NAME",
            false,
        )?,
        zitadel_secrets_path: load_env("zitadel", "ZITADEL_SECRETS_PATH", false)?,
    })
}
