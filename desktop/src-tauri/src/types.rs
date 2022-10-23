use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// this is appended to the files
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilezClientAppDataFile {
    pub modified: Option<u64>,
    pub created: u64,
    /**
     Filez has no notion of folders, so we need to store the path to the file to display a virtual folder structure
    */
    pub path: Option<String>,
    pub id: String,
}

// this is appended to the user
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilezClientConfig {
    pub sync_operations: Option<HashMap<String, SyncOperation>>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncOperation {
    pub local_folder: String,
    pub remote_volume: String,
    pub last_sync: Option<i64>,
    pub interval: i64,
    pub group_id: String,
    pub sync_type: SyncType,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub enum SyncType {
    /**
    The local folders files are replicated to the volume
    */
    Push,
    /**
    The local folders files are uploaded to the volume and then deleted
    */
    PushDelete,
    /**
    The remote volumes files are replicated in the local folder
    */
    Pull,
    /**
    The remote volumes files are downloaded to the local folder and then deleted from the remote volume
    */
    PullDelete,
    /**
    Remote and local files are synced
    */
    Merge,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IntermediaryFile {
    pub path: Option<String>,
    pub real_path: Option<String>,
    pub existing_id: Option<String>,
    pub client_id: String,
    pub name: String,
    pub modified: Option<u64>,
    pub created: u64,
    pub size: u64,
    pub mime_type: String,
}
