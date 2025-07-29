// This file is auto-generated from OpenAPI specification
use serde::{Deserialize, Serialize};
use serde_json::Value;



#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicyAction {
    FilezFilesCreate,
FilezFilesDelete,
FilezFilesGet,
FilezFilesUpdate,
FilezFilesVersionsContentGet,
FilezFilesVersionsContentTusHead,
FilezFilesVersionsContentTusPatch,
FilezFilesVersionsDelete,
FilezFilesVersionsGet,
FilezFilesVersionsUpdate,
FilezFilesVersionsCreate,
UsersGet,
UsersList,
UsersCreate,
UsersUpdate,
UsersDelete,
FileGroupsCreate,
FileGroupsGet,
FileGroupsUpdate,
FileGroupsDelete,
FileGroupsList,
FileGroupsListFiles,
FileGroupsUpdateMembers,
UserGroupsCreate,
UserGroupsGet,
UserGroupsUpdate,
UserGroupsDelete,
UserGroupsList,
UserGroupsListUsers,
UserGroupsUpdateMembers,
AccessPoliciesCreate,
AccessPoliciesGet,
AccessPoliciesUpdate,
AccessPoliciesDelete,
AccessPoliciesList,
StorageQuotasCreate,
StorageQuotasGet,
StorageQuotasUpdate,
StorageQuotasDelete,
StorageQuotasList,
StorageLocationsGet,
StorageLocationsList,
TagsUpdate,
TagsGet
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicyEffect {
    Deny,
Allow
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicyResourceType {
    File,
FileGroup,
User,
UserGroup,
StorageLocation,
AccessPolicy,
StorageQuota
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicySubjectType {
    User,
UserGroup,
ServerMember,
Public
}



















































































































#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileGroupType {
    Manual,
Dynamic
}















#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilezUserType {
    SuperAdmin,
Regular,
KeyAccess
}



























#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListAccessPoliciesSortBy {
    CreatedTime,
ModifiedTime,
Name
}





#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFileGroupsSortBy {
    Name,
CreatedTime,
ModifiedTime
}





#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFilesSortBy {
    Name,
CreatedTime,
ModifiedTime
}











#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListStorageLocationsSortBy {
    CreatedTime,
ModifiedTime,
Name
}



#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListStorageQuotasSortBy {
    CreatedTime,
ModifiedTime,
SubjectType,
SubjectId,
StorageLocationId
}





#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListUserGroupsSortBy {
    Name,
CreatedTime,
ModifiedTime
}





#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListUsersSortBy {
    CreatedTime,
ModifiedTime,
Name
}



#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    Ascending,
Descending
}





#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TagResourceType {
    File,
FileVersion,
FileGroup,
User,
UserGroup,
StorageLocation,
AccessPolicy,
StorageQuota
}






























