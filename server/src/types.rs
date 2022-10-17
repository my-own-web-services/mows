use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashMap, hash::Hash};

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub variable_prefix: String,
    #[serde(with = "serde_yaml::with::singleton_map_recursive", default)]
    pub storage: HashMap<String, StorageConfig>,
    pub default_storage: String,
}
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StorageConfig {
    pub path: String,
    /**
    A storage location: either to seperate files onto different drives because of speed or type
    */
    pub limit: Option<u64>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CreateFileRequest {
    pub name: String,
    pub mime_type: String,
    pub storage_name: Option<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CreateFileResponse {
    pub id: String,
    pub storage_name: String,
    pub sha256: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FilezFile {
    #[serde(rename = "_key")]
    pub id: String,
    pub mime_type: String,
    pub name: String,
    pub owner: String,
    pub sha256: String,
    pub storage_name: String,
    pub size: u64,
    pub created: i64,
    pub modified: Option<i64>,
    pub accessed: Option<i64>,
    pub accessed_count: u64,
    pub groups: Option<Vec<String>>,
    /**
        UTC timecode after which the file should be deleted (German for time of death)
    */
    pub todeszeitpunkt: Option<i64>,
    /**
     A key value store for apps to store information
     The String is the app name and the Value is its data
    */
    pub app_data: Option<HashMap<String, Value>>,
}
