use crate::{config::SERVER_CONFIG, db::DB, internal_types::Auth, utils::merge_values};
use anyhow::bail;
use filez_common::server::{
    FilezFile, FilezFileGroup, FilezUser, FilezUserGroup, PermissiveResource,
};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
pub enum CommonAclWhatOptions {
    File(FilezFilePermissionAclWhatOptions),
    FileGroup(FilezFileGroupPermissionAclWhatOptions),
    UserGroup(FilezUserGroupPermissionAclWhatOptions),
    User(FilezUserPermissionAclWhatOptions),
}

// TODO make all methods use this and accept multiple resources at once

pub async fn check_auth_multiple(
    auth: &Auth,
    auth_resources: &Vec<Box<dyn PermissiveResource>>,
    acl_what_options: &CommonAclWhatOptions,
    db: &DB,
) -> anyhow::Result<bool> {
    let config = &SERVER_CONFIG;

    let requesting_user = match &auth.authenticated_ir_user_id {
        Some(ir_user_id) => match db.get_user_by_ir_id(ir_user_id).await? {
            Some(u) => u,
            None => bail!("User has not been created on the filez server, although it is present on the IR server. Run create_own first."),
        },
        None => return Ok(false),
    };

    // check if the requesting user is the owner of the resources
    let is_owner_of_all = auth_resources.iter().all(|auth_resource| {
        if &requesting_user.user_id == auth_resource.get_owner_id() {
            return true;
        };

        false
    });

    if is_owner_of_all {
        // user is the owner
        return Ok(true);
    };

    if config.dev.disable_complex_access_control {
        bail!("Complex access control has been disabled");
    };

    // get the permission ids of all resources and deupe them
    let permission_ids = auth_resources
        .iter()
        .flat_map(|auth_resource| auth_resource.get_permission_ids().clone())
        .unique()
        .collect::<Vec<_>>();

    // get all permissions that are relevant to this request at once
    let permissions = db.get_permissions_by_resource_ids(&permission_ids).await?;

    for auth_resource in auth_resources {
        // get the permissions now from the array that contains all permissions instead of querying the db each time
        let resource_permissions = permissions
            .iter()
            .filter(|p| {
                auth_resource
                    .get_permission_ids()
                    .contains(&p.permission_id)
            })
            .cloned()
            .collect::<Vec<_>>();

        // merge the permissions that are present on the resource
        let merged_permission_content = merge_permission_content(resource_permissions)?;

        let maybe_acl_who = match (merged_permission_content, acl_what_options) {
            (PermissionResourceType::File(prt), CommonAclWhatOptions::File(ar)) => {
                if let Some(acl) = prt.acl {
                    if acl.what.contains(ar) {
                        Some(acl.who)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            (PermissionResourceType::FileGroup(prt), CommonAclWhatOptions::FileGroup(ar)) => {
                if let Some(acl) = prt.acl {
                    if acl.what.contains(ar) {
                        Some(acl.who)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            (PermissionResourceType::UserGroup(prt), CommonAclWhatOptions::UserGroup(ar)) => {
                if let Some(acl) = prt.acl {
                    if acl.what.contains(ar) {
                        Some(acl.who)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            (PermissionResourceType::User(prt), CommonAclWhatOptions::User(ar)) => {
                if let Some(acl) = prt.acl {
                    if acl.what.contains(ar) {
                        Some(acl.who)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            _ => bail!("Permission type does not match resource type"),
        };

        match maybe_acl_who {
            Some(acl_who) => {
                if let Some(link) = acl_who.link {
                    if link {
                        return Ok(true);
                    }
                }
                if let Some(policy_passwords) = acl_who.passwords {
                    if let Some(auth_password) = &auth.password {
                        if policy_passwords.contains(auth_password) {
                            return Ok(true);
                        }
                    }
                }
                if let Some(policy_users) = acl_who.users {
                    if policy_users.user_ids.contains(&requesting_user.user_id) {
                        return Ok(true);
                    }

                    // check if both arrays share at least one element

                    if requesting_user
                        .user_group_ids
                        .iter()
                        .any(|user_group_id| policy_users.user_group_ids.contains(user_group_id))
                    {
                        return Ok(true);
                    }
                }
            }
            None => {
                // check ribston
            }
        };
    }

    Ok(false)
}

pub enum AuthResourceToCheck<'a> {
    File((&'a FilezFile, FilezFilePermissionAclWhatOptions)),
    FileGroup((&'a FilezFileGroup, FilezFileGroupPermissionAclWhatOptions)),
    User((&'a FilezUser, FilezUserPermissionAclWhatOptions)),
    UserGroup((&'a FilezUserGroup, FilezUserGroupPermissionAclWhatOptions)),
}

pub async fn check_auth(
    auth: &Auth,
    auth_resource: &AuthResourceToCheck<'_>,
    db: &DB,
) -> anyhow::Result<bool> {
    let config = &SERVER_CONFIG;

    let requesting_user = match &auth.authenticated_ir_user_id {
        Some(ir_user_id) => match db.get_user_by_ir_id(ir_user_id).await? {
            Some(u) => u,
            None => bail!("User has not been created on the filez server, although it is present on the IR server. Run create_own first."),
        },
        None => return Ok(false),
    };

    // check if the requesting user is the owner of the resource
    let owner_id = match auth_resource {
        AuthResourceToCheck::File(f) => &f.0.owner_id,
        AuthResourceToCheck::FileGroup(fg) => &fg.0.owner_id,
        AuthResourceToCheck::User(u) => &u.0.user_id,
        AuthResourceToCheck::UserGroup(ug) => &ug.0.owner_id,
    };

    if owner_id == &requesting_user.user_id {
        // user is the owner
        return Ok(true);
    }

    if config.dev.disable_complex_access_control {
        bail!("Complex access control has been disabled");
    };

    let permission_ids = match auth_resource {
        AuthResourceToCheck::File(f) => &f.0.permission_ids,
        AuthResourceToCheck::FileGroup(fg) => &fg.0.permission_ids,
        AuthResourceToCheck::User(u) => &u.0.permission_ids,
        AuthResourceToCheck::UserGroup(ug) => &ug.0.permission_ids,
    };

    let permissions = db.get_permissions_by_resource_ids(permission_ids).await?;

    let merged_permission_content = merge_permission_content(permissions)?;

    let maybe_acl_who = match (merged_permission_content, auth_resource) {
        (PermissionResourceType::File(prt), AuthResourceToCheck::File(ar)) => {
            if let Some(acl) = prt.acl {
                if acl.what.contains(&ar.1) {
                    Some(acl.who)
                } else {
                    None
                }
            } else {
                None
            }
        }

        (PermissionResourceType::FileGroup(prt), AuthResourceToCheck::FileGroup(ar)) => {
            if let Some(acl) = prt.acl {
                if acl.what.contains(&ar.1) {
                    Some(acl.who)
                } else {
                    None
                }
            } else {
                None
            }
        }

        (PermissionResourceType::UserGroup(prt), AuthResourceToCheck::UserGroup(ar)) => {
            if let Some(acl) = prt.acl {
                if acl.what.contains(&ar.1) {
                    Some(acl.who)
                } else {
                    None
                }
            } else {
                None
            }
        }

        (PermissionResourceType::User(prt), AuthResourceToCheck::User(ar)) => {
            if let Some(acl) = prt.acl {
                if acl.what.contains(&ar.1) {
                    Some(acl.who)
                } else {
                    None
                }
            } else {
                None
            }
        }

        _ => bail!("Permission type does not match resource type"),
    };

    match maybe_acl_who {
        Some(acl_who) => {
            if let Some(link) = acl_who.link {
                if link {
                    return Ok(true);
                }
            }
            if let Some(policy_passwords) = acl_who.passwords {
                if let Some(auth_password) = &auth.password {
                    if policy_passwords.contains(auth_password) {
                        return Ok(true);
                    }
                }
            }
            if let Some(policy_users) = acl_who.users {
                if policy_users.user_ids.contains(&requesting_user.user_id) {
                    return Ok(true);
                }

                // check if both arrays share at least one element

                if requesting_user
                    .user_group_ids
                    .iter()
                    .any(|user_group_id| policy_users.user_group_ids.contains(user_group_id))
                {
                    return Ok(true);
                }
            }
        }
        None => {
            // check ribston
        }
    };

    Ok(false)
}

pub fn merge_permission_content(
    permissions: Vec<FilezPermission>,
) -> anyhow::Result<PermissionResourceType> {
    if permissions.is_empty() {
        bail!("No permissions to merge");
    };

    let mut merged_permission_content = Value::Null;

    for permission in permissions {
        merge_values(
            &mut merged_permission_content,
            &serde_json::to_value(permission.content)?,
        );
    }

    let merged_permission_content: PermissionResourceType =
        serde_json::from_value(merged_permission_content)?;

    Ok(merged_permission_content)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezPermission {
    #[serde(rename = "_id")]
    pub permission_id: String,
    /** Whether the permission can be used once or multiple times */
    pub use_type: FilezPermissionUseType,
    pub name: Option<String>,
    /** Id of the User owning the permission */
    pub owner_id: String,
    pub content: PermissionResourceType,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[serde(tag = "type")]
pub enum PermissionResourceType {
    File(FilezPermissionResource<FilezFilePermissionAclWhatOptions>),
    FileGroup(FilezPermissionResource<FilezFileGroupPermissionAclWhatOptions>),
    UserGroup(FilezPermissionResource<FilezUserGroupPermissionAclWhatOptions>),
    User(FilezPermissionResource<FilezUserPermissionAclWhatOptions>),
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum PermissionResourceSelectType {
    File,
    FileGroup,
    UserGroup,
    User,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezPermissionResource<T> {
    pub acl: Option<FilezPermissionAcl<T>>,
    pub ribston: Option<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilezPermissionUseType {
    Once,
    Multiple,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezPermissionAcl<T> {
    pub who: FilezPermissionAclWho,
    pub what: Vec<T>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezPermissionAclWho {
    pub link: Option<bool>,
    pub passwords: Option<Vec<String>>,
    pub users: Option<FilezPermissionAclUsers>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct FilezPermissionAclUsers {
    /** List of users that have access to the parent resource */
    pub user_ids: Vec<String>,
    /** List of user groups that have access to the parent resource */
    pub user_group_ids: Vec<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilezFilePermissionAclWhatOptions {
    GetFile,
    GetFileDerivatives,
    GetFileInfos,
    DeleteFile,
    UpdateFileInfosName,
    UpdateFileInfosMimeType,
    UpdateFileInfosKeywords,
    UpdateFileInfosStaticFileGroups,
    UpdateFile,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilezFileGroupPermissionAclWhatOptions {
    ListFiles,
    GetGroupInfos,
    DeleteGroup,
    UpdateGroupInfosName,
    UpdateGroupInfosKeywords,
    UpdateGroupInfosDynamicGroupRules,
    UpdateGroupInfosGroupType,
    UpdateGroupInfosMimeTypes,
    UpdateGroupInfosGroupHierarchyPaths,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilezUserGroupPermissionAclWhatOptions {
    GetGroupInfos,
    DeleteGroup,
    UpdateGroupInfosName,
    UpdateGroupInfosVisibility,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilezUserPermissionAclWhatOptions {
    GetUser,
}
