use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    types::{FilezFile, FilezFileGroup, FilezUser, UserGroup},
};
use anyhow::bail;
use serde::{Deserialize, Serialize};

use ts_rs::TS;

pub enum AuthResourceToCheck<'a> {
    File((&'a FilezFile, FilezFilePermissionAclWhatOptions)),
    FileGroup((&'a FilezFileGroup, FilezFileGroupPermissionAclWhatOptions)),
    User((&'a FilezUser, FilezUserPermissionAclWhatOptions)),
    UserGroup((&'a UserGroup, FilezUserGroupPermissionAclWhatOptions)),
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

    // user is not the owner
    // check if file is public
    // let permissions = db.get_permissions_from_file(file).await?;

    // if we dont have permission from the easy to check acl yet we need to check ribston

    // send all policies to ribston for evaluation
    // all need to be true for access to be granted

    Ok(false)
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
    pub password: Option<String>,
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
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilezUserPermissionAclWhatOptions {
    GetUser,
}
