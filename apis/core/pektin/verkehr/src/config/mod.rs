use mows_common_rust::config::load_env;
use serde::Deserialize;
use std::sync::OnceLock;
use tokio::sync::RwLock;

pub mod providers;
pub mod routing_config;
pub mod rules;

pub fn config() -> &'static RwLock<VerkehrConfig> {
    static CONFIG: OnceLock<RwLock<VerkehrConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Deserialize, Debug, Clone)]
pub struct VerkehrConfig {
    pub reconcile_interval_seconds: u64,
    pub file_provider_directory_path: Option<String>,
    pub docker_provider_enabled: bool,
    pub kubernetes_controller_enabled: bool,
}

#[tracing::instrument(level = "trace")]
pub fn from_env() -> anyhow::Result<VerkehrConfig> {
    let file_provider_directory_path =
        load_env("None", "FILE_PROVIDER_DIRECTORY_PATH", false, true)?;
    let file_provider_directory_path = if file_provider_directory_path == "None" {
        None
    } else {
        Some(file_provider_directory_path)
    };

    Ok(VerkehrConfig {
        reconcile_interval_seconds: load_env("60", "RECONCILE_INTERVAL_SECONDS", false, true)?
            .parse::<u64>()?,
        file_provider_directory_path,
        docker_provider_enabled: load_env("false", "DOCKER_PROVIDER_ENABLED", false, true)?
            .parse::<bool>()?,
        kubernetes_controller_enabled: load_env(
            "true",
            "KUBERNETES_CONTROLLER_ENABLED",
            false,
            true,
        )?
        .parse::<bool>()?,
    })
}
