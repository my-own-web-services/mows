use std::sync::OnceLock;

use mows_common::config::load_env;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

pub fn config() -> &'static RwLock<ZertificatConfig> {
    static CONFIG: OnceLock<RwLock<ZertificatConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ZertificatConfig {
    pub vault_uri: String,
    pub service_account_token_path: String,
    pub vault_kubernetes_auth_path: String,
    pub vault_kubernetes_auth_role: String,
    pub vault_kubernetes_api_auth_path: String,
    pub vault_secret_engine_path: String,
    pub pektin_api_endpoint: String,
    pub pektin_username: String,
    pub wait_minutes: u64,
    pub acme_email: String,
    pub acme_url: String,
    pub use_local_pebble: bool,
}

pub fn from_env() -> anyhow::Result<ZertificatConfig> {
    Ok(ZertificatConfig {
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
            "mows-core-secrets-vrc/mows-core-dns-pektin/pektin-kubernetes",
            "VAULT_KUBERNETES_AUTH_PATH",
            false,
            true,
        )?,
        vault_kubernetes_api_auth_path: load_env(
            "mows-core-secrets-vrc/mows-core-dns-pektin/pektin-kubernetes-api-clients",
            "VAULT_KUBERNETES_API_AUTH_PATH",
            false,
            true,
        )?,
        vault_kubernetes_auth_role: load_env(
            "pektin-zertificat",
            "VAULT_KUBERNETES_AUTH_ROLE",
            false,
            true,
        )?,
        vault_secret_engine_path: load_env(
            "mows-core-secrets-vrc/mows-core-dns-pektin/pektin-zertificat",
            "VAULT_SECRET_ENGINE_PATH",
            false,
            true,
        )?,
        pektin_api_endpoint: load_env("http://pektin-api", "PEKTIN_API_ENDPOINT", false, true)?,
        pektin_username: load_env("pektin-zertificat", "PEKTIN_USERNAME", false, true)?,
        acme_email: load_env("admin@pektin", "ACME_EMAIL", false, true)?,
        acme_url: load_env("http://acme:14000", "ACME_URL", false, true)?,
        use_local_pebble: load_env("false", "USE_LOCAL_PEBBLE", false, true)? == "true",
        wait_minutes: load_env("5", "WAIT_MINUTES", false, true)?.parse()?,
    })
}
