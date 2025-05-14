use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use ts_rs::TS;

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct LinkedFile {
    pub file_id: String,
    pub link_type: FileLinkType,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FileLinkType {
    Child,
    Parent,
    Sibling,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezFile {
    /**
      cannot be updated
    */
    #[serde(rename = "_id")]
    pub file_id: String,
    /**
      can be updated with update_file_infos
    */
    pub mime_type: String,
    /**
      can be updated with update_file_infos
    */
    pub name: String,
    /**
      can be updated with update_file_infos by the current owner
    */
    pub owner_id: String,
    /**
      can be updated with update_file_infos by the current owner
    */
    pub pending_new_owner_id: Option<String>,
    /**
     can be updated by updating the files content with update_file
    */
    pub sha256: Option<String>,
    /**
      can be updated with update_file_infos
    */
    pub storage_id: Option<String>,
    /**
      can be updated by updating the files content with update_file
    */
    #[ts(type = "number")]
    pub size: u64,
    /**
      can't be updated
    */
    #[ts(type = "number")]
    pub server_created: i64,
    #[ts(type = "number")]
    pub created: i64,
    #[ts(type = "number")]
    pub modified: Option<i64>,
    /**
    The last time the file was accessed
    */
    #[ts(type = "number")]
    pub accessed: Option<i64>,
    /**
    How many times the file was accessed
    */
    #[ts(type = "number")]
    pub accessed_count: u64,
    /**
    The manually assigned FileGroups. Can be updated with update_file_infos
    */
    pub static_file_group_ids: Vec<String>,
    /**
    Can't be updated manually but will update on file or group changes
    */
    pub dynamic_file_group_ids: Vec<String>,
    /**
    A map of the groups the file is in and its position in the group
    */
    pub manual_group_sortings: HashMap<String, u64>,
    /**
        UTC timecode after which the file should be deleted
    */
    #[ts(type = "number")]
    pub time_of_death: Option<i64>,
    /**
     A key value store for apps to store information
     The String is the app name and the Value is its data
     can be updated by set_app_data
    */
    #[ts(type = "Record<string, any>")]
    pub app_data: HashMap<String, Value>,
    /**
      can be updated by update_permission_ids_on_resource
    */
    pub permission_ids: Vec<String>,
    /**
      can be updated with update_file_infos
    */
    pub keywords: Vec<String>,
    /**
      can't be updated
    */
    pub readonly: bool,
    pub readonly_path: Option<String>,

    pub linked_files: Vec<LinkedFile>,
    pub sub_type: Option<FileType>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FileType {
    /**
     Files that share the same underlying data but have different metadata
    */
    Copy,
    /**
     Files that have no underlying data but are just placeholders for missing files/ are there for their metadata
    */
    Placeholder,
}
