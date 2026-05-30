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

static CONFIG_LOCK: OnceLock<RwLock<ChatServerConfig>> = OnceLock::new();

/// Eagerly initialize the global config. Called from `main()`
/// before anything else; surfaces env-var parse failures as an
/// `anyhow::Error` instead of an in-`expect()` SIGABRT so the
/// runtime can exit cleanly with status 1.
pub fn init_config() -> anyhow::Result<()> {
    let cfg = from_env()?;
    // Ignore the conflict case — re-initialising the same global
    // is fine and tests may legitimately call init twice. Only
    // the first set wins; subsequent calls observe via config().
    let _ = CONFIG_LOCK.set(RwLock::new(cfg));
    Ok(())
}

pub fn config() -> &'static RwLock<ChatServerConfig> {
    // Falls back to a lazy init for unit tests or any path that
    // didn't go through main() (which would have called
    // init_config() first and propagated any error). On a missing
    // env var here we still abort — but the abort path now only
    // fires when `main()` skipped calling `init_config()`, which
    // is a programmer error rather than user input.
    CONFIG_LOCK.get_or_init(|| {
        RwLock::new(from_env().unwrap_or_else(|e| {
            tracing::error!("FATAL: config accessed before init_config(): {e}");
            std::process::exit(1);
        }))
    })
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
    /// Allow the WebSocket auth-fallback via `?user=<uuid>` query
    /// string. **NEVER set this in production** — browsers can't
    /// set arbitrary headers on WS upgrades, so dev tooling needs
    /// a query-string fallback, but the same path is a full
    /// auth-bypass if exposed to the public internet. Off by
    /// default; a config drift to `enable_dev=true` alone does
    /// NOT enable this — the operator has to explicitly opt in
    /// via a separate env var. See review A1 (SLOP-2 / TASTE-7).
    pub enable_dev_user_query_auth: bool,
    /// Bind address. Used by main() to assert the dev-only
    /// `?user=` query fallback is bound to localhost only when
    /// enabled. Production binds 0.0.0.0; localhost binds
    /// 127.0.0.1.
    pub bind_address: String,
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
        enable_dev_user_query_auth: load_env(
            "false",
            "ENABLE_DEV_USER_QUERY_AUTH",
            false,
            true,
        )?
        .parse::<bool>()?,
        bind_address: load_env("0.0.0.0", "BIND_ADDRESS", false, true)?,
    })
}
