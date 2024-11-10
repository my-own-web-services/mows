use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use crate::errors::MowsError;

pub fn common_config() -> &'static RwLock<CommonConfig> {
    static CONFIG: OnceLock<RwLock<CommonConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CommonConfig {
    pub otel_endpoint_url: String,
    pub log_filter: String,
    pub tracing_filter: String,
    pub service_name: String,
    pub service_version: String,
}

pub fn from_env() -> Result<CommonConfig, MowsError> {
    Ok(CommonConfig {
        otel_endpoint_url: load_env(
            "http://mows-core-tracing-jaeger-collector.mows-core-tracing:4317",
            "OTEL_ENDPOINT_URL",
            false,
        )?,
        log_filter: load_env("info", "LOG_FILTER", false)?,
        tracing_filter: load_env("info", "TRACING_FILTER", false)?,
        service_name: load_env(env!("CARGO_PKG_NAME"), "SERVICE_NAME", false)?,
        service_version: load_env(env!("CARGO_PKG_VERSION"), "SERVICE_VERSION", false)?,
    })
}

pub fn load_env(default: &str, param_name: &str, confidential: bool) -> Result<String, MowsError> {
    let res = if let Ok(param) = std::env::var(param_name) {
        if param_name.ends_with("_FILE") {
            return match std::fs::read_to_string(&param) {
                Ok(val) => Ok(val),
                Err(err) => Err(MowsError::ConfigError(format!(
                    "Failed to read file {}: {}",
                    param, err
                ))),
            };
        }
        param
    } else if default.is_empty() {
        return Err(MowsError::ConfigError(param_name.into()));
    } else {
        default.into()
    };
    if !confidential {
        println!("\t{}={}", param_name, res);
    } else {
        println!("\t{}=<REDACTED (len={})>", param_name, res.len());
    }
    Ok(res)
}

#[macro_export]
macro_rules! get_current_config_cloned {
    ($config:expr) => {{
        tracing::debug!(target: "config_locks","Trying to read config: {} {}", file!(), line!());
        let cfg_lock = $config.read().await.clone();
        tracing::debug!(target: "config_locks","Got config: {} {}", file!(), line!());
        cfg_lock
    }};
}

#[macro_export]
macro_rules! write_config {
    ($config:expr) => {{
        tracing::debug!(target: "config_locks","Writing config: {} {}", file!(), line!());
        $config.write().await
    }};
}
