use super::{
    file::FilezFile, file_group::FilezFileGroup, user::FilezUser, user_group::FilezUserGroup,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
pub enum CommonAclWhatOptions {
    File(FilezFilePermissionAclWhatOptions),
    FileGroup(FilezFileGroupPermissionAclWhatOptions),
    UserGroup(FilezUserGroupPermissionAclWhatOptions),
    User(FilezUserPermissionAclWhatOptions),
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

// TODO add a field for a list of origins/applications that are allowed to use the resource that the permission applies to
// this makes it possible to only give an app minimal access to the resources it needs
// per default only the management app is allowed to use the resource regardless of the set origins

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
    pub user_ids: Vec<String>,
    pub user_group_ids: Vec<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilezFilePermissionAclWhatOptions {
    FileList,
    FileGet,
    FileGetDerivatives,
    FileGetInfos,
    FileDelete,
    FileUpdateInfosName,
    FileUpdateInfosMimeType,
    FileUpdateInfosKeywords,
    FileUpdateInfosStaticFileGroups,
    FileUpdate,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilezFileGroupPermissionAclWhatOptions {
    // File
    FileList,
    FileGet,
    FileGetDerivatives,
    FileGetInfos,
    FileDelete,
    FileUpdateInfosName,
    FileUpdateInfosMimeType,
    FileUpdateInfosKeywords,
    FileUpdateInfosStaticFileGroups,
    FileUpdate,
    // FileGroup
    FileGroupList,
    FileGroupGetInfos,
    FileGroupDelete,
    FileGroupUpdateInfosName,
    FileGroupUpdateInfosKeywords,
    FileGroupUpdateInfosDynamicGroupRules,
    FileGroupUpdateInfosGroupType,
    FileGroupUpdateInfosMimeTypes,
    FileGroupUpdateInfosGroupHierarchyPaths,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilezUserGroupPermissionAclWhatOptions {
    UserGroupGetInfos,
    UserGroupDelete,
    UserGroupUpdateInfosName,
    UserGroupUpdateInfosVisibility,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub enum FilezUserPermissionAclWhatOptions {
    UserGet,
    UserDelete,
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
