use mows_common_rust::config::load_env;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::sync::RwLock;
use url::Url;

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
        primary_origin: load_env("", "PRIMARY_ORIGIN", false, true)?.parse::<Url>()?,
        enable_dev: load_env("false", "ENABLE_DEV", false, true)?.parse::<bool>()?,
        dev_allow_origins,
        db_url: load_env("/db/mows-package-manager.db", "DATABASE_URL", false, true)?,
        oidc_client_id: load_env("", "OIDC_CLIENT_ID", false, true)?,
        oidc_client_secret: load_env("", "OIDC_CLIENT_SECRET", true, true)?,
        oidc_issuer: load_env("", "OIDC_ISSUER", false, true)?,
    })
}
