use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use ts_rs::TS;

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UpdateFriendshipStatusRequestBody {
    pub user_id: String,
    pub new_status: UpdateFriendStatus,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum UpdateFriendStatus {
    SendFriendRequest,
    RemoveFriend,
    AcceptFriendRequest,
    RejectFriendRequest,
}

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
    pub created_time_millis: i64,
    pub updated_time_millis: i64,
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
    pub started_time_millis: i64,
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
pub struct CreateUploadSpaceRequestBody {
    pub limits: HashMap<String, CusrLimits>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct CusrLimits {
    pub max_storage: u64,
    pub max_files: u64,
    pub max_bandwidth: u64,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UpdatePermissionsRequestBody {
    pub permission_ids: Vec<String>,
    pub resource_id: String,
    pub resource_type: FileResourceType,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum FileResourceType {
    FileGroup,
    File,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct DeletePermissionRequestBody {
    pub permission_id: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct CreatePermissionRequestBody {
    pub name: Option<String>,
    pub acl: Option<FilezPermissionAcl>,
    pub ribston: Option<String>,
    pub use_type: FilezPermissionUseType,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct CreatePermissionResponseBody {
    pub permission_id: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UpdateFileGroupRequestBody {
    pub file_group_id: String,
    pub new_name: Option<String>,
    pub new_dynamic_group_rules: Option<FilterRule>,
    pub new_group_type: Option<FileGroupType>,
    pub new_keywords: Option<Vec<String>>,
    pub new_mime_types: Option<Vec<String>>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct CreateFileGroupRequestBody {
    pub name: Option<String>,
    pub visibility: Visibility,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct CreateUserGroupRequestBody {
    pub name: Option<String>,
    pub visibility: Visibility,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct CreateUserGroupResponseBody {
    pub group_id: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct CreateFileGroupResponseBody {
    pub group_id: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UpdateFileInfosRequest {
    pub file_id: String,
    pub field: UpdateFileInfosRequestField,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum UpdateFileInfosRequestField {
    MimeType(String),
    Name(String),
    OwnerId(String),
    StorageId(String),
    StaticFileGroupIds(Vec<String>),
    Keywords(Vec<String>),
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UpdateFileRequest {
    pub file_id: String,
    pub modified: Option<i64>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UpdateFileResponse {
    pub sha256: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct CreateFileRequest {
    pub name: String,
    pub mime_type: String,
    pub storage_id: Option<String>,
    pub static_file_group_ids: Option<Vec<String>>,
    pub created: Option<i64>,
    pub modified: Option<i64>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct CreateFileResponse {
    pub file_id: String,
    pub storage_name: String,
    pub sha256: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct SetAppDataRequest {
    pub app_data_type: AppDataType,
    pub id: String,
    pub app_name: String,
    #[ts(type = "any")]
    pub app_data: Value,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum AppDataType {
    File,
    User,
}

// Database specifics

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
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
    pub path: String,
    /**
      can be updated by updating the files content with update_file
    */
    pub size: u64,
    /**
      can't be updated
    */
    pub server_created: i64,
    pub created: i64,
    pub modified: Option<i64>,
    /**
      the last time the file was accessed
    */
    pub accessed: Option<i64>,
    /**
      how many times the file was accessed
    */
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
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
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
    pub limits: HashMap<String, UsageLimits>,
    /**
    List of group ids that the user is a member of
    */
    pub user_group_ids: Vec<String>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum UserRole {
    Admin,
    User,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum UserStatus {
    Active,
    Invited,
    Disabled,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum Visibility {
    Public,
    Private,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UsageLimits {
    pub max_storage: u64,
    pub used_storage: u64,
    pub max_files: u64,
    pub used_files: u64,
    pub max_bandwidth: u64,
    pub used_bandwidth: u64,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UserGroup {
    #[serde(rename = "_id")]
    pub user_group_id: String,
    pub name: Option<String>,
    /** Id of the User owning the user group*/
    pub owner_id: String,
    pub visibility: Visibility,
}

// file groups are just selectors for files
#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
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
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct FilterRule {
    pub field: String,
    pub rule_type: FilterRuleType,
    pub value: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum FilterRuleType {
    MatchRegex,
    NotMatchRegex,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum FileGroupType {
    Static,
    Dynamic,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UploadSpace {
    #[serde(rename = "_id")]
    pub upload_space_id: String,
    pub owner_id: String,
    pub limits: HashMap<String, UsageLimits>,
    pub file_group_id: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct FilezPermission {
    #[serde(rename = "_id")]
    pub permission_id: String,
    /** Whether the permission can be used once or multiple times */
    pub use_type: FilezPermissionUseType,
    pub name: Option<String>,
    /** Id of the User owning the permission */
    pub owner_id: String,
    pub acl: Option<FilezPermissionAcl>,
    pub ribston: Option<String>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum FilezPermissionUseType {
    Once,
    Multiple,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct FilezPermissionAcl {
    pub who: FilezPermissionAclWho,
    pub what_file: Vec<FilezFilePermissionAclWhatOptions>,
    pub what_group: Vec<FilezGroupPermissionAclWhatOptions>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct FilezPermissionAclWho {
    pub link: Option<bool>,
    pub password: Option<String>,
    pub users: Option<FilezPermissionAclUsers>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct FilezPermissionAclUsers {
    /** List of users that have access to the parent resource */
    pub user_ids: Vec<String>,
    /** List of user groups that have access to the parent resource */
    pub user_group_ids: Vec<String>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum FilezFilePermissionAclWhatOptions {
    GetFile,
    GetFileInfos,
    DeleteFile,
    UpdateFileInfosName,
    UpdateFileInfosMimeType,
    UpdateFileInfosKeywords,
    UpdateFileInfosStaticFileGroups,
    UpdateFile,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum FilezGroupPermissionAclWhatOptions {
    ListFiles,
    GetGroupInfos,
    DeleteGroup,
    UpdateGroupInfosName,
    UpdateGroupInfosKeywords,
    UpdateGroupInfosDynamicGroupRules,
}
