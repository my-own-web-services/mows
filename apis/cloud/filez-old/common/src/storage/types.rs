use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf};

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StorageConfig {
    #[serde(with = "serde_yaml::with::singleton_map_recursive", default)]
    pub storages: HashMap<String, Storage>,
    pub default_storage: String,
}

/**
A storage location: either to seperate files onto different drives or because of speed or type
*/
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Storage {
    pub path: PathBuf,
    pub limit: Option<u64>,
    #[serde(with = "serde_yaml::with::singleton_map_recursive", default)]
    pub app_storage: HashMap<String, AppStorage>,
    pub default_user_limits: Option<DefaultUserLimits>,
    pub readonly: Option<ReadonlyConfig>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReadonlyConfig {
    pub rescan_seconds: u64,
    pub owner_email: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppStorage {
    pub path: PathBuf,
    pub limit: Option<u64>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DefaultUserLimits {
    pub max_storage: u64,
    pub max_files: u64,
    pub max_bandwidth: u64,
}
