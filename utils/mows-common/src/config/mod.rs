use crate::{constants::MowsConstants, errors::MowsError};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tokio::sync::RwLock;

// TODO load the config first into a hashmap with the mows common logic and then into the struct in the dependent services
// TODO auto-reload the config

pub fn common_config(log_vars: bool) -> &'static RwLock<CommonConfig> {
    static CONFIG: OnceLock<RwLock<CommonConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env(log_vars).unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CommonConfig {
    pub otel_endpoint_url: String,
    pub log_filter: String,
    pub tracing_filter: String,
    pub service_name: String,
    pub service_version: String,
    pub constants: MowsConstants,
}

pub fn from_env(log_vars: bool) -> Result<CommonConfig, MowsError> {
    Ok(CommonConfig {
        otel_endpoint_url: load_env(
            "http://mows-core-tracing-jaeger-collector.mows-core-tracing:4317",
            "OTEL_ENDPOINT_URL",
            false,
            log_vars,
        )?,
        log_filter: load_env("info", "LOG_FILTER", false, log_vars)?,
        tracing_filter: load_env("info", "TRACING_FILTER", false, log_vars)?,
        service_name: load_env(env!("CARGO_PKG_NAME"), "SERVICE_NAME", false, log_vars)?,
        service_version: load_env(
            env!("CARGO_PKG_VERSION"),
            "SERVICE_VERSION",
            false,
            log_vars,
        )?,
        constants: MowsConstants::default(),
    })
}

// TODO, this can be improved, show as what it is parsed, warn if it contains whitespace

pub fn load_env(
    default: &str,
    param_name: &str,
    confidential: bool,
    log_vars: bool,
) -> Result<String, MowsError> {
    let param_value = if let Ok(param) = std::env::var(param_name) {
        if param_name.ends_with("_FROM_FILE_PATH") {
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

    if log_vars {
        if confidential {
            println!("{}=<REDACTED, length={}>\n", param_name, param_value.len());
        } else {
            println!("{}={}\n", param_name, make_whitespace_visible(&param_value));
        }
        println!();
    }
    Ok(param_value)
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

pub fn make_whitespace_visible(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            ' ' => '·',
            '\t' => '⇥',
            '\n' => '↵',
            '\r' => '↵',
            _ => c,
        })
        .collect()
}
