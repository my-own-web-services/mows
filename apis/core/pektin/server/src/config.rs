use std::{net::Ipv6Addr, sync::OnceLock};

use mows_common_rust::config::{load_env, MowsConfigError};
use tokio::sync::RwLock;

pub fn config() -> &'static RwLock<ServerConfig> {
    static SERVER_CONFIG: OnceLock<RwLock<ServerConfig>> = OnceLock::new();
    SERVER_CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerConfig {
    pub bind_address: Ipv6Addr,
    pub bind_port: u16,
    pub db_hostname: String,
    pub db_username: String,
    pub db_password: String,
    pub db_port: u16,
    pub db_retry_seconds: u64,
    pub tcp_timeout_seconds: u64,
    pub use_doh: bool,
    pub doh_bind_address: Ipv6Addr,
    pub doh_bind_port: u16,
}

pub fn from_env() -> Result<ServerConfig, MowsConfigError> {
    Ok(ServerConfig {
        bind_address: load_env("::", "BIND_ADDRESS", false, true)?.parse()?,
        bind_port: load_env("53", "BIND_PORT", false, true)?.parse()?,
        db_hostname: load_env("pektin-db", "DB_HOSTNAME", false, true)?,
        db_port: load_env("6379", "DB_PORT", false, true)?.parse()?,
        db_username: load_env("db-pektin-server", "DB_USERNAME", false, true)?,
        db_password: load_env("", "DB_PASSWORD", true, true)?,
        db_retry_seconds: load_env("1", "DB_RETRY_SECONDS", false, true)?.parse()?,
        tcp_timeout_seconds: load_env("3", "TCP_TIMEOUT_SECONDS", false, true)?.parse()?,
        use_doh: load_env("true", "USE_DOH", false, true)? == "true",
        doh_bind_port: load_env("80", "DOH_BIND_PORT", false, true)?.parse()?,
        doh_bind_address: load_env("::", "DOH_BIND_ADDRESS", false, true)?.parse()?,
    })
}
