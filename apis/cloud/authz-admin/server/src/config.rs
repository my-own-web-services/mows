//! authz-admin runtime configuration.
//!
//! Single env-var entrypoint, projected into one struct so the rest
//! of the codebase never touches std::env directly. Pattern mirrors
//! realtime-server / filez-server so a future shared `mows-service-core`
//! crate can subsume the boilerplate.
//!
//! authz-admin is a BFF + static-asset host; it owns no database
//! and no migrations. The config surface is therefore much smaller
//! than the data-bearing services':
//!
//!   * `LISTEN_PORT` / `BIND_ADDRESS` — where to serve
//!   * `REALTIME_BASE_URL` / `FILEZ_BASE_URL` — upstream consumers
//!     to aggregate. Empty string disables that upstream entirely;
//!     a future operator-provisioned service registry will replace
//!     this hand-list when more than ~5 consumers exist.

use mows_common_rust::config::load_env;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::sync::RwLock;

static CONFIG_LOCK: OnceLock<RwLock<AuthzAdminConfig>> = OnceLock::new();

pub fn init_config() -> anyhow::Result<()> {
    let cfg = from_env()?;
    let _ = CONFIG_LOCK.set(RwLock::new(cfg));
    Ok(())
}

pub fn config() -> &'static RwLock<AuthzAdminConfig> {
    CONFIG_LOCK.get_or_init(|| {
        RwLock::new(from_env().unwrap_or_else(|e| {
            tracing::error!("FATAL: config accessed before init_config(): {e}");
            std::process::exit(1);
        }))
    })
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthzAdminConfig {
    pub listen_port: u16,
    pub bind_address: String,
    /// Realtime-server base URL (no trailing slash, e.g.
    /// `http://realtime-server:8080`). Empty string => realtime
    /// is not aggregated.
    pub realtime_base_url: String,
    /// filez-server base URL (no trailing slash). Empty string =>
    /// filez is not aggregated.
    pub filez_base_url: String,
}

#[tracing::instrument(level = "trace")]
pub fn from_env() -> anyhow::Result<AuthzAdminConfig> {
    // The upstream URLs are truly optional — `mows_common_rust::load_env`
    // treats an empty-string default as "no default", which would
    // make them mandatory. Read those directly via `std::env::var`
    // so an operator can deploy with just `REALTIME_BASE_URL` set
    // (filez disabled) or vice versa.
    Ok(AuthzAdminConfig {
        listen_port: load_env("8080", "LISTEN_PORT", false, true)?.parse::<u16>()?,
        bind_address: load_env("0.0.0.0", "BIND_ADDRESS", false, true)?,
        realtime_base_url: std::env::var("REALTIME_BASE_URL").unwrap_or_default(),
        filez_base_url: std::env::var("FILEZ_BASE_URL").unwrap_or_default(),
    })
}
