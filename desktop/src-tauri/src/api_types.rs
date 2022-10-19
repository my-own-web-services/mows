use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFileRequest {
    pub file_id: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFileResponse {
    pub sha256: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateFileRequest {
    pub name: String,
    pub mime_type: String,
    pub storage_name: Option<String>,
    pub groups: Option<Vec<String>>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateFileResponse {
    pub id: String,
    pub storage_name: String,
    pub sha256: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
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
        UTC timecode after which the file should be deleted
    */
    pub time_of_death: Option<i64>,
    /**
     A key value store for apps to store information
     The String is the app name and the Value is its data
    */
    pub app_data: Option<HashMap<String, Value>>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilezUser {
    #[serde(rename = "_key")]
    pub id: String,
    pub app_data: Option<HashMap<String, Value>>,
    pub limits: HashMap<String, UserLimits>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserLimits {
    pub max_storage: u64,
    pub used_storage: u64,
    pub max_files: u64,
    pub used_files: u64,
    pub max_bandwidth: u64,
    pub used_bandwidth: u64,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SetAppDataRequest {
    pub app_data_type: AppDataType,
    pub id: String,
    pub app_name: String,
    pub app_data: Value,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub enum AppDataType {
    File,
    User,
}
