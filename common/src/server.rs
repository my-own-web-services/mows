use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use ts_rs::TS;

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct ReducedFilezUser {
    pub _id: String,
    pub name: Option<String>,
    pub friendship_status: FriendshipStatus,
    pub status: UserStatus,
    pub visibility: Visibility,
    pub role: UserRole,
    pub shared_user_groups: Vec<String>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum FriendshipStatus {
    Friends,
    NotFriends,
    AwaitingTheirConfirmation,
    AwaitingYourConfirmation,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct GetItemListResponseBody<T> {
    pub items: Vec<T>,
    pub total_count: u32,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct GetItemListRequestBody {
    pub id: Option<String>,
    pub from_index: u64,
    pub limit: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<SortOrder>,
    pub filter: Option<String>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum SortOrder {
    Ascending,
    Descending,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Job {
    #[serde(rename = "_id")]
    pub job_id: String,
    /**
     The id of the app that should handle the job
    */
    pub for_app_id: String,
    /**
     A key value store to give the app information about how the job should be performed
    */
    #[ts(type = "Record<string, any>")]
    pub app_info: HashMap<String, Value>,
    pub job_type: JobType,
    pub status: JobStatus,
    #[ts(type = "number")]
    pub created_time_millis: i64,
    #[ts(type = "number")]
    pub updated_time_millis: i64,
    #[ts(type = "number")]
    pub end_time_millis: Option<i64>,
    pub stages: Vec<JobStage>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum JobType {
    FileJob(FileJob),
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct FileJob {
    pub file_id: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct JobStage {
    pub status: JobStatus,
    #[ts(type = "number")]
    pub started_time_millis: i64,
    #[ts(type = "number")]
    pub end_time_millis: Option<i64>,
    pub title: String,
    pub description: String,
    pub error: Option<String>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum JobStatus {
    Pending,
    Running,
    Done,
    Error,
    Rejected,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct CusrLimits {
    #[ts(type = "number")]
    pub max_storage: u64,
    #[ts(type = "number")]
    pub max_files: u64,
    #[ts(type = "number")]
    pub max_bandwidth: u64,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum FileResourceType {
    FileGroup,
    File,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum AppDataType {
    File,
    User,
}

// Database specifics

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
      the last time the file was accessed
    */
    #[ts(type = "number")]
    pub accessed: Option<i64>,
    /**
      how many times the file was accessed
    */
    #[ts(type = "number")]
    pub accessed_count: u64,
    /**
      can be updated with update_file_infos
    */
    pub static_file_group_ids: Vec<String>,
    /**
    can't be updated manually but will update on file or group changes
    */
    pub dynamic_file_group_ids: Vec<String>,
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
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezUser {
    #[serde(rename = "_id")]
    pub user_id: String,
    pub ir_user_id: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub role: UserRole,
    pub visibility: Visibility,
    pub friends: Vec<String>,
    /*
    Incoming friend requests awaiting confirmation by the user
    */
    pub pending_incoming_friend_requests: Vec<String>,
    pub status: UserStatus,
    #[ts(type = "Record<string, any>")]
    pub app_data: HashMap<String, Value>,
    pub limits: HashMap<String, Option<UsageLimits>>,
    /**
    List of group ids that the user is a member of
    */
    pub user_group_ids: Vec<String>,
    pub permission_ids: Vec<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum UserRole {
    Admin,
    User,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum UserStatus {
    Active,
    Invited,
    Disabled,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum Visibility {
    Public,
    Private,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UsageLimits {
    #[ts(type = "number")]
    pub max_storage: u64,
    #[ts(type = "number")]
    pub used_storage: u64,
    #[ts(type = "number")]
    pub max_files: u64,
    #[ts(type = "number")]
    pub used_files: u64,
    #[ts(type = "number")]
    pub max_bandwidth: u64,
    #[ts(type = "number")]
    pub used_bandwidth: u64,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezUserGroup {
    #[serde(rename = "_id")]
    pub user_group_id: String,
    pub name: Option<String>,
    /** Id of the User owning the user group*/
    pub owner_id: String,
    pub visibility: Visibility,
    pub permission_ids: Vec<String>,
}

// file groups are just selectors for files
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezFileGroup {
    #[serde(rename = "_id")]
    pub file_group_id: String,
    pub name: Option<String>,
    /** Id of the User owning the file group*/
    pub owner_id: String,
    /**
     *  List of permission ids for this file group
     *  The Permissions will be merged and then evaluated
     */
    pub permission_ids: Vec<String>,
    pub keywords: Vec<String>,
    pub mime_types: Vec<String>,
    /**
     * Paths that allows the user to create a hierarchy of file groups
     */
    pub group_hierarchy_paths: Vec<String>,
    pub group_type: FileGroupType,
    pub dynamic_group_rules: Option<FilterRule>,
    pub item_count: u32,
    pub readonly: bool,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilterRule {
    pub field: String,
    pub rule_type: FilterRuleType,
    pub value: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilterRuleType {
    MatchRegex,
    NotMatchRegex,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FileGroupType {
    Static,
    Dynamic,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct UploadSpace {
    #[serde(rename = "_id")]
    pub upload_space_id: String,
    pub owner_id: String,
    pub limits: HashMap<String, UsageLimits>,
    pub file_group_id: String,
}

#[typetag::serde(tag = "type")]
pub trait PermissiveResource: Send + Sync {
    fn get_permission_ids(&self) -> &Vec<String>;
    fn get_owner_id(&self) -> &String;
}

#[typetag::serde]
impl PermissiveResource for FilezFile {
    fn get_permission_ids(&self) -> &Vec<String> {
        &self.permission_ids
    }

    fn get_owner_id(&self) -> &String {
        &self.owner_id
    }
}
#[typetag::serde]
impl PermissiveResource for FilezFileGroup {
    fn get_permission_ids(&self) -> &Vec<String> {
        &self.permission_ids
    }

    fn get_owner_id(&self) -> &String {
        &self.owner_id
    }
}
#[typetag::serde]
impl PermissiveResource for FilezUserGroup {
    fn get_permission_ids(&self) -> &Vec<String> {
        &self.permission_ids
    }

    fn get_owner_id(&self) -> &String {
        &self.owner_id
    }
}
#[typetag::serde]
impl PermissiveResource for FilezUser {
    fn get_permission_ids(&self) -> &Vec<String> {
        &self.permission_ids
    }

    fn get_owner_id(&self) -> &String {
        &self.user_id
    }
}
