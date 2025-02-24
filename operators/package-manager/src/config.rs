use mows_common::config::load_env;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::sync::RwLock;
use url::Url;

pub fn config() -> &'static RwLock<PackageManagerConfig> {
    static CONFIG: OnceLock<RwLock<PackageManagerConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PackageManagerConfig {
    pub vault_uri: String,
    pub service_account_token_path: String,
    pub vault_kubernetes_api_auth_path: String,
    pub primary_origin: Url,
    pub enable_dev: bool,
    pub dev_allow_origins: Vec<Url>,
    pub db_url: String,
    pub working_dir: String,
}

pub fn from_env() -> anyhow::Result<PackageManagerConfig> {
    let dev_allow_origins = match load_env("", "DEV_ALLOW_ORIGINS", false, true) {
        Ok(v) => v
            .split(",")
            .map(|x| x.to_string().parse::<Url>().unwrap())
            .collect(),
        Err(_) => Vec::new(),
    };

    Ok(PackageManagerConfig {
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

        vault_kubernetes_api_auth_path: load_env(
            "mows-core-secrets-vrc/mows-core-package-manager/cluster-params",
            "VAULT_KUBERNETES_API_AUTH_PATH",
            false,
            true,
        )?,
        primary_origin: load_env("", "PRIMARY_ORIGIN", false, true)?.parse::<Url>()?,
        enable_dev: load_env("false", "ENABLE_DEV", false, true)?.parse::<bool>()?,
        dev_allow_origins,
        db_url: load_env("/db/mows-package-manager.db", "DATABASE_URL", false, true)?,
        working_dir: load_env("/tmp/mows-package-manager", "WORKING_DIR", false, true)?,
    })
}
