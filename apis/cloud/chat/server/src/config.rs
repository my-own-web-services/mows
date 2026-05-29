//! Chat-server runtime configuration.
//!
//! All env-vars are read here and projected into a single
//! [`ChatServerConfig`] struct so the rest of the codebase never
//! touches `std::env` directly (CLAUDE.md: "all environment
//! variables that are used in the codebase for whatever reason
//! need to be read upfront in one central file and added to a
//! config struct"). Pattern mirrors `filez-server`'s `config.rs`
//! so a future `mows-service-core` extraction can subsume both.

use mows_common_rust::config::load_env;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::sync::RwLock;

pub fn config() -> &'static RwLock<ChatServerConfig> {
    static CONFIG: OnceLock<RwLock<ChatServerConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().expect("failed to load ChatServerConfig")))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatServerConfig {
    pub db_url: String,
    pub listen_port: u16,
    pub enable_dev: bool,
    pub dev_allow_origins: Vec<String>,
    pub oidc_issuer: String,
    pub oidc_client_id: String,
    pub oidc_client_secret: String,
}

#[tracing::instrument(level = "trace")]
pub fn from_env() -> anyhow::Result<ChatServerConfig> {
    let dev_allow_origins = match load_env("", "DEV_ALLOW_ORIGINS", false, true) {
        Ok(v) => v
            .split(',')
            .filter(|s| !s.is_empty())
            .map(|s| s.trim().to_string())
            .collect(),
        Err(_) => Vec::new(),
    };

    Ok(ChatServerConfig {
        db_url: load_env(
            "postgres://chat:chat@chat-db/chat",
            "DATABASE_URL",
            true,
            true,
        )?,
        listen_port: load_env("8080", "LISTEN_PORT", false, true)?.parse::<u16>()?,
        enable_dev: load_env("false", "ENABLE_DEV", false, true)?.parse::<bool>()?,
        dev_allow_origins,
        oidc_issuer: load_env("http://localhost", "OIDC_ISSUER", false, true)?,
        oidc_client_id: load_env("a", "OIDC_CLIENT_ID", false, true)?,
        oidc_client_secret: load_env("a", "OIDC_CLIENT_SECRET", true, true)?,
    })
}
