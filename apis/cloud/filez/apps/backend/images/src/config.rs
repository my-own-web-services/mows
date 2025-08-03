use mows_common_rust::config::load_env;
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::OnceLock};
use tokio::sync::RwLock;
use url::Url;

pub fn config() -> &'static RwLock<ImagesConfig> {
    static CONFIG: OnceLock<RwLock<ImagesConfig>> = OnceLock::new();
    CONFIG.get_or_init(|| RwLock::new(from_env().unwrap()))
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ImagesConfig {
    pub filez_server_url: Url,
    pub working_directory: PathBuf,
    pub no_work_wait_seconds: u64,
}

pub fn from_env() -> anyhow::Result<ImagesConfig> {
    Ok(ImagesConfig {
        filez_server_url: load_env(
            "http://filez-server.mows-core-storage-filez:80",
            "FILEZ_SERVER_URL",
            false,
            true,
        )?
        .parse::<Url>()?,
        working_directory: PathBuf::from(load_env("/working", "WORKING_DIRECTORY", false, true)?),
        no_work_wait_seconds: load_env("5", "NO_WORK_WAIT_SECONDS", false, true)?.parse::<u64>()?,
    })
}
