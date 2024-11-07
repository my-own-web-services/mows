use std::sync::OnceLock;

use pektin_common::load_env;
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
    pub reconcile_interval_seconds: u64,
    pub otel_endpoint_url: String,
    pub log_filter: String,
    pub tracing_filter: String,
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
        reconcile_interval_seconds: load_env("30", "RECONCILE_INTERVAL", false)?.parse()?,
        otel_endpoint_url: load_env(
            "http://mows-core-tracing-jaeger-collector.mows-core-tracing:4317",
            "OTEL_ENDPOINT_URL",
            false,
        )?,
        log_filter: load_env("info", "LOG_FILTER", false)?,
        tracing_filter: load_env("info", "TRACING_FILTER", false)?,
    })
}
