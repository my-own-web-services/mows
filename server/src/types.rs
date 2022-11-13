use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateUploadSpaceRequest {
    pub limits: HashMap<String, CusrLimits>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CusrLimits {
    pub max_storage: u64,
    pub max_files: u64,
    pub max_bandwidth: u64,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePermissionsRequest {
    pub permission_ids: Vec<String>,
    pub resource_id: String,
    pub resource_type: FileResourceType,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub enum FileResourceType {
    FileGroup,
    File,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeleteGroupRequest {
    pub group_id: String,
    pub group_type: GroupType,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeletePermissionRequest {
    pub permission_id: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreatePermissionRequest {
    pub name: Option<String>,
    pub acl: Option<FilezPermissionAcl>,
    pub ribston: Option<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreatePermissionResponse {
    pub permission_id: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupRequest {
    pub name: Option<String>,
    pub group_type: GroupType,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub enum GroupType {
    User,
    File,
}
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupResponse {
    pub group_id: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFileRequest {
    pub file_id: String,
    pub modified: Option<i64>,
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
    pub created: Option<i64>,
    pub modified: Option<i64>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateFileResponse {
    pub file_id: String,
    pub storage_name: String,
    pub sha256: String,
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

// Database specifics

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilezFile {
    #[serde(rename = "_key")]
    pub file_id: String,
    pub mime_type: String,
    pub name: String,
    pub owner_id: String,
    pub sha256: String,
    pub storage_name: String,
    pub size: u64,
    pub server_created: i64,
    pub created: i64,
    pub modified: Option<i64>,
    pub accessed: Option<i64>,
    pub accessed_count: u64,
    pub static_file_group_ids: Vec<String>,
    pub dynamic_file_group_ids: Vec<String>,
    /**
        UTC timecode after which the file should be deleted
    */
    pub time_of_death: Option<i64>,
    /**
     A key value store for apps to store information
     The String is the app name and the Value is its data
    */
    pub app_data: HashMap<String, Value>,
    pub permission_ids: Vec<String>,
    pub keywords: Vec<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilezUser {
    #[serde(rename = "_key")]
    pub user_id: String,
    pub app_data: HashMap<String, Value>,
    pub limits: HashMap<String, UsageLimits>,
    /**
    List of group ids that the user is a member of
    */
    pub user_group_ids: Vec<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageLimits {
    pub max_storage: u64,
    pub used_storage: u64,
    pub max_files: u64,
    pub used_files: u64,
    pub max_bandwidth: u64,
    pub used_bandwidth: u64,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
#[serde(untagged)]
pub enum FilezGroups {
    FilezUserGroup(FilezUserGroup),
    FilezFileGroup(FilezFileGroup),
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilezUserGroup {
    #[serde(rename = "_key")]
    pub user_group_id: String,
    pub name: Option<String>,
    /** Id of the User owning the user group*/
    pub owner_id: String,
}

// file groups are just selectors for files
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilezFileGroup {
    #[serde(rename = "_key")]
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
}
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub enum FileGroupType {
    Static,
    Dynamic,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UploadSpace {
    #[serde(rename = "_key")]
    pub upload_space_id: String,
    pub owner_id: String,
    pub limits: HashMap<String, UsageLimits>,
    pub file_group_id: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilezPermission {
    #[serde(rename = "_key")]
    pub permission_id: String,
    pub name: Option<String>,
    /** Id of the User owning the permission */
    pub owner_id: String,
    pub acl: Option<FilezPermissionAcl>,
    pub ribston: Option<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilezPermissionAcl {
    pub everyone: Option<EveryoneAcl>,
    pub passwords: Option<PasswordAcl>,
    pub users: Option<UsersAcl>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct EveryoneAcl {
    pub get_file: Option<bool>,
    pub update_file: Option<bool>,
    pub delete_file: Option<bool>,
    pub get_file_info: Option<bool>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct PasswordAcl {
    pub get_file: Option<Vec<String>>,
    pub update_file: Option<Vec<String>>,
    pub delete_file: Option<Vec<String>>,
    pub get_file_info: Option<Vec<String>>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct UsersAcl {
    pub get_file: Option<UsersAclUsersAndUserGroups>,
    pub update_file: Option<UsersAclUsersAndUserGroups>,
    pub delete_file: Option<UsersAclUsersAndUserGroups>,
    pub get_file_info: Option<UsersAclUsersAndUserGroups>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsersAclUsersAndUserGroups {
    /** List of users that have access to the parent resource */
    pub user_ids: Option<Vec<String>>,
    /** List of user groups that have access to the parent resource */
    pub user_group_ids: Option<Vec<String>>,
}
