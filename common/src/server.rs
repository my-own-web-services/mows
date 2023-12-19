use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use ts_rs::TS;

use crate::{storage::types::StorageConfig, utils::generate_id};

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
    #[ts(optional)]
    pub id: Option<String>,
    #[ts(type = "number", optional)]
    pub from_index: Option<u64>,
    #[ts(type = "number", optional)]
    pub limit: Option<u64>,
    #[ts(optional)]
    pub sort_field: Option<String>,
    #[ts(optional)]
    pub sort_order: Option<SortOrder>,
    #[ts(optional)]
    pub filter: Option<String>,
    #[ts(optional)]
    pub sub_resource_type: Option<String>,
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
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum JobStatus {
    Pending,
    Running,
    Done,
    Error(String),
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
    /**
    Permissions attached to the user
    */
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
    /** The user has not been invited yet and is just a placeholder to attach other resources to */
    Placeholder,
    /** The user has never logged in, another user requested to invite them to the server.
     The String is the id of the user that requested the invitation
    */
    InvitationRequested,
    /** The user has never logged in but a invitation to join the server has been sent, this can only be set by the admin or with appropriate permissions */
    Invited,
    /** The user can login and manage their visibility, request to join public groups etc. */
    Active,
    /** The user has been removed from the server either because they were banned or wanted to be removed */
    Removed,
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
    pub deletable: bool,
    pub readonly: bool,
    pub all: bool,
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
    Contains,
    NotContains,
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

impl FilezUser {
    pub fn new(
        storage_config: &StorageConfig,
        name: Option<String>,
        email: Option<String>,
        ir_user_id: Option<String>,
    ) -> Self {
        let mut limits: HashMap<String, Option<UsageLimits>> = HashMap::new();

        for (storage_name, storage_config) in &storage_config.storages {
            let l = storage_config
                .default_user_limits
                .as_ref()
                .map(|dul| UsageLimits {
                    max_storage: dul.max_storage,
                    used_storage: 0,
                    max_files: dul.max_files,
                    used_files: 0,
                    max_bandwidth: dul.max_bandwidth,
                    used_bandwidth: 0,
                });
            limits.insert(storage_name.to_string(), l);
        }

        let user_id = generate_id(16);

        Self {
            user_id,
            ir_user_id,
            name,
            email,
            role: UserRole::User,
            visibility: Visibility::Private,
            friends: vec![],
            pending_incoming_friend_requests: vec![],
            status: UserStatus::Placeholder,
            app_data: HashMap::new(),
            limits,
            user_group_ids: vec![],
            permission_ids: vec![],
        }
    }

    pub fn make_admin(&mut self) {
        self.role = UserRole::Admin;
    }

    pub fn update_status(&mut self, new_status: UserStatus) {
        self.status = new_status;
    }

    pub fn create_all_group(&self) -> FilezFileGroup {
        FilezFileGroup::new_all_group(self)
    }
}

impl FilezFileGroup {
    pub fn new(owner: &FilezUser, group_type: FileGroupType, name: Option<String>) -> Self {
        let file_group_id = generate_id(16);

        Self {
            file_group_id,
            name,
            owner_id: owner.user_id.clone(),
            permission_ids: vec![],
            keywords: vec![],
            mime_types: vec![],
            group_hierarchy_paths: vec![],
            group_type,
            dynamic_group_rules: None,
            item_count: 0,
            deletable: true,
            readonly: false,
            all: false,
        }
    }
    pub fn new_all_group(owner: &FilezUser) -> Self {
        let file_group_id = generate_id(16);

        Self {
            file_group_id,
            name: Some("All".to_string()),
            owner_id: owner.user_id.clone(),
            permission_ids: vec![],
            keywords: vec![],
            mime_types: vec![],
            group_hierarchy_paths: vec![],
            group_type: FileGroupType::Static,
            dynamic_group_rules: None,
            item_count: 0,
            deletable: false,
            readonly: true,
            all: true,
        }
    }

    pub fn make_undeleatable(&mut self) {
        self.deletable = false;
    }

    pub fn make_all_group(&mut self) {
        self.all = true;
    }

    pub fn make_readonly(&mut self) {
        self.readonly = true;
    }
}
