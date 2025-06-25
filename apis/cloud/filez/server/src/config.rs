use mows_common_rust::config::load_env;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::sync::RwLock;
use url::Url;

use crate::storage::config::StorageConfig;

pub fn config() -> &'static RwLock<FilezServerConfig> {
    static CONFIG: OnceLock<RwLock<FilezServerConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FilezServerConfig {
    pub primary_origin: Url,
    pub enable_dev: bool,
    pub dev_allow_origins: Vec<Url>,
    pub db_url: String,
    pub oidc_client_id: String,
    pub oidc_client_secret: String,
    pub oidc_issuer: String,
    pub minio_username: String,
    pub minio_password: String,
    pub minio_endpoint: String,
    pub default_storage_limit: i64,
    pub storage: StorageConfig,
    pub reconcile_interval_seconds: u64,
}

pub fn from_env() -> anyhow::Result<FilezServerConfig> {
    let dev_allow_origins = match load_env("", "DEV_ALLOW_ORIGINS", false, true) {
        Ok(v) => v
            .split(",")
            .map(|x| x.to_string().parse::<Url>().unwrap())
            .collect(),
        Err(_) => Vec::new(),
    };

    Ok(FilezServerConfig {
        primary_origin: load_env("http://localhost", "PRIMARY_ORIGIN", false, true)?
            .parse::<Url>()?,
        enable_dev: load_env("false", "ENABLE_DEV", false, true)?.parse::<bool>()?,
        dev_allow_origins,
        db_url: load_env(
            "postgres://filez:filez@localhost/filez",
            "DATABASE_URL",
            true,
            true,
        )?,
        oidc_client_id: load_env("a", "OIDC_CLIENT_ID", false, true)?,
        oidc_client_secret: load_env("a", "OIDC_CLIENT_SECRET", true, true)?,
        oidc_issuer: load_env("http://localhost", "OIDC_ISSUER", false, true)?,
        minio_username: load_env("a", "MINIO_USERNAME", false, true)?,
        minio_password: load_env("a", "MINIO_PASSWORD", true, true)?,
        minio_endpoint: load_env("http://localhost:9000", "MINIO_ENDPOINT", false, true)?,
        default_storage_limit: load_env("10737418240", "DEFAULT_STORAGE_LIMIT", false, true)?
            .parse::<i64>()?,
        storage: StorageConfig::default(),
        reconcile_interval_seconds: load_env("60", "RECONCILE_INTERVAL_SECONDS", false, true)?
            .parse::<u64>()?,
    })
}
