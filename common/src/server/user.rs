use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use ts_rs::TS;

use crate::{storage::types::StorageConfig, utils::generate_id};

use super::file_group::FilezFileGroup;

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezUser {
    #[serde(rename = "_id")]
    pub user_id: String,
    pub ir_user_id: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub role: UserRole,
    pub visibility: UserVisibility,
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
    /**
    The id of the user that created the user
    */
    pub creator_id: Option<String>,
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
    /**
    The user has not been invited yet and is just a placeholder to attach other resources to
    */
    Placeholder,
    /**
    The user has never logged in, another user requested to invite them to the server.
    The String is the id of the user that requested the invitation
    */
    InvitationRequested,
    /**
    The user has never logged in but a invitation to join the server has been sent, this can only be set by the admin or with appropriate permissions
    */
    Invited,
    /**
    The user can login and manage their visibility, request to join public groups etc.
    */
    Active,
    /**
    The user has been removed from the server either because they were banned or wanted to be removed
    */
    Removed,
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

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct ReducedFilezUser {
    pub _id: String,
    pub name: Option<String>,
    pub friendship_status: FriendshipStatus,
    pub status: UserStatus,
    pub visibility: UserVisibility,
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

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum UserVisibility {
    Public,
    Private,
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
            visibility: UserVisibility::Private,
            friends: vec![],
            pending_incoming_friend_requests: vec![],
            status: UserStatus::Placeholder,
            app_data: HashMap::new(),
            limits,
            user_group_ids: vec![],
            permission_ids: vec![],
            creator_id: None,
        }
    }

    pub fn apply_creator_id(&mut self, creator_id: String) {
        self.creator_id = Some(creator_id);
    }

    pub fn make_admin(&mut self) {
        self.role = UserRole::Admin;
    }

    pub fn update_status(&mut self, new_status: UserStatus) {
        self.status = new_status;
    }

    pub fn get_all_group(&self) -> FilezFileGroup {
        FilezFileGroup::new_all_group(self)
    }
}
