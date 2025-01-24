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
    pub service_account_token_path: String,
    pub zitadel_endpoint: String,
    pub reconcile_interval_seconds: u64,
}

pub fn from_env() -> anyhow::Result<ControllerConfig> {
    Ok(ControllerConfig {
        service_account_token_path: load_env(
            "/var/run/secrets/kubernetes.io/serviceaccount/token",
            "SERVICE_ACCOUNT_TOKEN_PATH",
            false,
        )?,

        zitadel_endpoint: load_env("http://zitadel", "ZITADEL_API_ENDPOINT", false)?,
        reconcile_interval_seconds: load_env("30", "RECONCILE_INTERVAL", false)?.parse()?,
    })
}
