use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// this is appended to the files
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FilezClientAppDataFile {
    pub original_modified_time: Option<u64>,
    pub original_created_time: Option<u64>,
    /**
     Filez has no notion of folders, so we need to store the path to the file to display a virtual folder structure
    */
    pub original_path: Option<String>,
    /**
     Whether the file is encrypted on the server
    */
    pub encrypted: bool,
}

// this is appended to the user
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FilezClientConfig {
    pub sync_operations: HashMap<String, SyncOperation>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SyncOperation {
    pub local_folder: String,
    pub remote_volume: String,
    pub server_url: Option<String>,
    pub last_sync: Option<i64>,
    pub interval: i64,
    pub group_id: String,
    pub sync_type: SyncType,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
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
