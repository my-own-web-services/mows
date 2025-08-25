// This file is auto-generated from OpenAPI specification
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use chrono::NaiveDateTime;
use std::collections::HashMap;

// AccessPolicyEffect
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicyEffect {
    Deny,
    Allow
}


// CreateFileVersionRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileVersionRequestBody {
    pub app_path: Option<String>,
    pub content_expected_sha256_digest: Option<String>,
    pub file_id: FilezFileId,
    pub file_version_metadata: FileVersionMetadata,
    pub file_version_mime_type: String,
    pub file_version_number: Option<u32>,
    pub file_version_size: u64,
    pub storage_quota_id: StorageQuotaId,
}


// AuthEvaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthEvaluation {
    pub is_allowed: bool,
    pub reason: AuthReason,
    pub resource_id: Option<String>,
}


// FilezFile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilezFile {
    pub created_time: NaiveDateTime,
    pub id: FilezFileId,
    pub metadata: FileMetadata,
    pub mime_type: String,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: FilezUserId,
}


// JobStatusDetailsCreated
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCreated {
    pub message: String,
}


// ListFilesSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFilesSortBy {
    Name,
    CreatedTime,
    ModifiedTime
}


// ApiResponse_ListStorageLocationsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListStorageLocationsResponseBody {
    pub data: ListStorageLocationsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListFilesSorting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFilesSorting {
    StoredSortOrder(ListFilesStoredSortOrder),
    SortOrder(ListFilesSortOrder)
}


// ListJobsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListJobsResponseBody {
    pub jobs: Vec<FilezJob>,
}


// ListStorageLocationsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListStorageLocationsSortBy {
    CreatedTime,
    ModifiedTime,
    Name
}


// ListStorageQuotasRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageQuotasRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListStorageQuotasSortBy>,
    pub sort_order: Option<SortDirection>,
}


// FileGroupType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileGroupType {
    Manual,
    Dynamic
}


// ApiResponse_CreateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateJobResponseBody {
    pub data: CreateJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// StorageQuotaSubjectId
pub type StorageQuotaSubjectId = Uuid;


// ApiResponse_GetFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetFileVersionsResponseBody {
    pub data: GetFileVersionsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_GetStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetStorageQuotaResponseBody {
    pub data: GetStorageQuotaResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// UpdateAccessPolicyChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAccessPolicyChangeset {
    pub new_access_policy_actions: Vec<AccessPolicyAction>,
    pub new_access_policy_effect: Option<AccessPolicyEffect>,
    pub new_access_policy_name: Option<String>,
    pub new_access_policy_resource_type: Option<AccessPolicyResourceType>,
    pub new_access_policy_subject_id: Option<AccessPolicySubjectId>,
    pub new_access_policy_subject_type: Option<AccessPolicySubjectType>,
    pub new_context_app_ids: Vec<MowsAppId>,
    pub new_resource_id: Option<String>,
}


// AccessPolicyAction
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
    TagsGet,
    FilezJobsCreate,
    FilezJobsGet,
    FilezJobsUpdate,
    FilezJobsDelete,
    FilezJobsList,
    FilezJobsPickup,
    FilezAppsGet,
    FilezAppsList
}


// UpdateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupResponseBody {
    pub updated_user_group: UserGroup,
}


// GetJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetJobRequestBody {
    pub job_id: FilezJobId,
}


// ListFileGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFileGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListFileGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}


// CreateFileGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileGroupResponseBody {
    pub created_file_group: FileGroup,
}


// GetFileVersionsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileVersionsRequestBody {
    pub file_version_ids: Vec<FileVersionId>,
}


// CreateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserGroupResponseBody {
    pub created_user_group: UserGroup,
}


// UpdateTagsMethod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UpdateTagsMethod {
    Add(HashMap<String, String>),
    Remove(HashMap<String, String>),
    Set(HashMap<String, String>),
    Clear
}


// TagResourceType
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


// FileGroup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileGroup {
    pub created_time: NaiveDateTime,
    pub dynamic_group_rule: Option<DynamicGroupRule>,
    pub group_type: FileGroupType,
    pub id: FileGroupId,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: FilezUserId,
}


// ListJobsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListJobsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListJobsSortBy>,
    pub sort_order: Option<SortDirection>,
}


// ListUserGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUserGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListUserGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}


// UpdateFileGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupRequestBody {
    pub changeset: UpdateFileGroupChangeset,
    pub file_group_id: FileGroupId,
}


// ApiResponse_CreateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateAccessPolicyResponseBody {
    pub data: CreateAccessPolicyResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_ListStorageQuotasResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListStorageQuotasResponseBody {
    pub data: ListStorageQuotasResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// CheckResourceAccessRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResourceAccessRequestBody {
    pub access_policy_action: AccessPolicyAction,
    pub access_policy_resource_type: AccessPolicyResourceType,
    pub requesting_app_origin: Option<String>,
    pub resource_ids: Vec<Uuid>,
}


// GetAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAppsResponseBody {
    pub apps: HashMap<Uuid, MowsApp>,
}


// ListStorageLocationsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageLocationsResponseBody {
    pub storage_locations: Vec<StorageLocationListItem>,
}


// PickupJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickupJobResponseBody {
    pub job: Option<FilezJob>,
}


// ListFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFileGroupsResponseBody {
    pub file_groups: Vec<FileGroup>,
}


// ListAccessPoliciesRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAccessPoliciesRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListAccessPoliciesSortBy>,
    pub sort_order: Option<SortDirection>,
}


// CreateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJobResponseBody {
    pub created_job: FilezJob,
}


// ListStorageQuotasSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListStorageQuotasSortBy {
    CreatedTime,
    ModifiedTime,
    SubjectType,
    SubjectId,
    StorageLocationId
}


// ApiResponse_CreateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateStorageQuotaResponseBody {
    pub data: CreateStorageQuotaResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// HealthStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub response: String,
}


// MowsApp
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MowsApp {
    pub app_type: AppType,
    pub created_time: NaiveDateTime,
    pub description: Option<String>,
    pub id: MowsAppId,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub origins: Vec<String>,
    pub trusted: bool,
}


// MowsAppId
pub type MowsAppId = Uuid;


// CreateFileGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileGroupRequestBody {
    pub dynamic_group_rule: Option<DynamicGroupRule>,
    pub file_group_name: String,
    pub file_group_type: FileGroupType,
}


// AppType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppType {
    #[serde(rename = "frontend")]
    Frontend,
    #[serde(rename = "backend")]
    Backend
}


// UpdateJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobRequestBody {
    pub changeset: UpdateJobChangeset,
    pub job_id: FilezJobId,
}


// UpdateTagsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTagsRequestBody {
    pub resource_ids: Vec<Uuid>,
    pub tag_resource_type: TagResourceType,
    pub update_tags: UpdateTagsMethod,
}


// GetUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUserGroupsResponseBody {
    pub user_groups: Vec<UserGroup>,
}


// ListFilesSortOrder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesSortOrder {
    pub sort_by: ListFilesSortBy,
    pub sort_order: Option<SortDirection>,
}


// ApiResponse_ListJobsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListJobsResponseBody {
    pub data: ListJobsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// CheckResourceAccessResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResourceAccessResponseBody {
    pub auth_evaluations: Vec<AuthEvaluation>,
}


// UserGroupId
pub type UserGroupId = Uuid;


// CreateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileResponseBody {
    pub created_file: FilezFile,
}


// ListFileGroupsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFileGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime
}


// UserMeta
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMeta {
    pub user: FilezUser,
}


// ListStorageLocationsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageLocationsRequestBody {
    pub sort_by: Option<ListStorageLocationsSortBy>,
    pub sort_order: Option<SortDirection>,
}


// AccessPolicy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessPolicy {
    pub actions: Vec<AccessPolicyAction>,
    pub context_app_ids: Vec<MowsAppId>,
    pub created_time: NaiveDateTime,
    pub effect: AccessPolicyEffect,
    pub id: AccessPolicyId,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: FilezUserId,
    pub resource_id: Option<String>,
    pub resource_type: AccessPolicyResourceType,
    pub subject_id: AccessPolicySubjectId,
    pub subject_type: AccessPolicySubjectType,
}


// ApiResponse_ListAccessPoliciesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListAccessPoliciesResponseBody {
    pub data: ListAccessPoliciesResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_PickupJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponsePickupJobResponseBody {
    pub data: PickupJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListAppsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAppsRequestBody {
    
}


// ApiResponse_String
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseString {
    pub data: String,
    pub message: String,
    pub status: ApiResponseStatus,
}


// FileVersionMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersionMetadata {
    
}


// ApiResponse_EmptyApiResponse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseEmptyApiResponse {
    pub data: EmptyApiResponse,
    pub message: String,
    pub status: ApiResponseStatus,
}


// FilezJob
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilezJob {
    pub app_id: MowsAppId,
    pub app_instance_last_seen_time: Option<String>,
    pub assigned_app_runtime_instance_id: Option<String>,
    pub created_time: NaiveDateTime,
    pub deadline_time: Option<String>,
    pub end_time: Option<String>,
    pub execution_information: JobExecutionInformation,
    pub id: FilezJobId,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: FilezUserId,
    pub persistence: JobPersistenceType,
    pub start_time: Option<String>,
    pub status: JobStatus,
    pub status_details: Option<JobStatusDetails>,
}


// GetJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetJobResponseBody {
    pub job: FilezJob,
}


// ListFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesResponseBody {
    pub files: Vec<FilezFile>,
    pub total_count: u64,
}


// AuthReason
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthReason {
    SuperAdmin,
    Owned,
    AllowedByPubliclyAccessible{
        policy_id: AccessPolicyId,
    },
    AllowedByServerAccessible{
        policy_id: AccessPolicyId,
    },
    AllowedByDirectUserPolicy{
        policy_id: AccessPolicyId,
    },
    AllowedByDirectUserGroupPolicy{
        policy_id: AccessPolicyId,
    via_user_group_id: UserGroupId,
    },
    AllowedByResourceGroupUserPolicy{
        on_resource_group_id: Uuid,
    policy_id: AccessPolicyId,
    },
    AllowedByResourceGroupUserGroupPolicy{
        on_resource_group_id: Uuid,
    policy_id: AccessPolicyId,
    via_user_group_id: UserGroupId,
    },
    DeniedByPubliclyAccessible{
        policy_id: AccessPolicyId,
    },
    DeniedByServerAccessible{
        policy_id: AccessPolicyId,
    },
    DeniedByDirectUserPolicy{
        policy_id: AccessPolicyId,
    },
    DeniedByDirectUserGroupPolicy{
        policy_id: AccessPolicyId,
    via_user_group_id: UserGroupId,
    },
    DeniedByResourceGroupUserPolicy{
        on_resource_group_id: Uuid,
    policy_id: AccessPolicyId,
    },
    DeniedByResourceGroupUserGroupPolicy{
        on_resource_group_id: Uuid,
    policy_id: AccessPolicyId,
    via_user_group_id: UserGroupId,
    },
    NoMatchingAllowPolicy,
    ResourceNotFound
}


// ListFilesStoredSortOrder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesStoredSortOrder {
    pub direction: Option<SortDirection>,
    pub stored_sort_order_id: Uuid,
}


// ListUserGroupsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListUserGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime
}


// StorageQuotaId
pub type StorageQuotaId = Uuid;


// UpdateUserGroupChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupChangeset {
    pub new_user_group_name: Option<String>,
}


// GetStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaResponseBody {
    pub storage_quotas: Vec<StorageQuota>,
}


// StorageQuotaSubjectType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StorageQuotaSubjectType {
    User,
    UserGroup
}


// UpdateAccessPolicyRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAccessPolicyRequestBody {
    pub access_policy_id: AccessPolicyId,
    pub changeset: UpdateAccessPolicyChangeset,
}


// UpdateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobResponseBody {
    pub job: FilezJob,
}


// DynamicGroupRule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicGroupRule {
    
}


// ApiResponse_UpdateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateStorageQuotaResponseBody {
    pub data: UpdateStorageQuotaResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// CreateUserRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserRequestBody {
    pub email: String,
}


// GetFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileVersionsResponseBody {
    pub file_versions: Vec<FileVersion>,
}


// ListAccessPoliciesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAccessPoliciesResponseBody {
    pub access_policies: Vec<AccessPolicy>,
}


// FilezUser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilezUser {
    pub created_by: Option<FilezUserId>,
    pub created_time: NaiveDateTime,
    pub deleted: bool,
    pub display_name: String,
    pub external_user_id: Option<String>,
    pub id: FilezUserId,
    pub modified_time: NaiveDateTime,
    pub pre_identifier_email: Option<String>,
    pub profile_picture: Option<FilezFileId>,
    pub user_type: FilezUserType,
}


// StorageLocationListItem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageLocationListItem {
    pub created_time: NaiveDateTime,
    pub id: StorageLocationId,
    pub modified_time: NaiveDateTime,
    pub name: String,
}


// CreateFileVersionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileVersionResponseBody {
    pub created_file_version: FileVersion,
}


// ApiResponse_CreateFileGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateFileGroupResponseBody {
    pub data: CreateFileGroupResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// GetFileGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileGroupsRequestBody {
    pub file_group_ids: Vec<FileGroupId>,
}


// GetFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFilesResponseBody {
    pub files: Vec<FilezFile>,
}


// ApiResponse_UpdateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateJobResponseBody {
    pub data: UpdateJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_GetFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetFilesResponseBody {
    pub data: GetFilesResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_GetTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetTagsResponseBody {
    pub data: GetTagsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_GetUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetUserGroupsResponseBody {
    pub data: GetUserGroupsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_CreateUserResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateUserResponseBody {
    pub data: CreateUserResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_ListFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListFilesResponseBody {
    pub data: ListFilesResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListStorageQuotasResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageQuotasResponseBody {
    pub storage_quotas: Vec<StorageQuota>,
}


// AccessPolicySubjectId
pub type AccessPolicySubjectId = Uuid;


// GetUsersReqBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUsersReqBody {
    pub user_ids: Vec<FilezUserId>,
}


// StorageQuota
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageQuota {
    pub created_time: NaiveDateTime,
    pub id: StorageQuotaId,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: FilezUserId,
    pub quota_bytes: i64,
    pub storage_location_id: StorageLocationId,
    pub subject_id: StorageQuotaSubjectId,
    pub subject_type: StorageQuotaSubjectType,
}


// UpdateFileVersionChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionChangeset {
    pub new_content_expected_sha256_digest: Option<String>,
    pub new_file_version_metadata: Option<FileVersionMetadata>,
    pub new_file_version_mime_type: Option<String>,
}


// HealthResBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResBody {
    pub all_healthy: bool,
    pub controller: HealthStatus,
    pub database: HealthStatus,
    pub storage_locations: HashMap<Uuid, HealthStatus>,
    pub zitadel: HealthStatus,
}


// ListUsersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUsersRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<SortDirection>,
    pub user_group_id: UserGroupId,
}


// UpdateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorageQuotaResponseBody {
    pub updated_storage_quota: StorageQuota,
}


// ApiResponse_GetFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetFileGroupsResponseBody {
    pub data: GetFileGroupsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// StorageLocationId
pub type StorageLocationId = Uuid;


// ApiResponse_ListFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListFileGroupsResponseBody {
    pub data: ListFileGroupsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// FilezJobId
pub type FilezJobId = Uuid;


// GetUsersResBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUsersResBody {
    pub users_meta: HashMap<Uuid, UserMeta>,
}


// ApiResponse_ListAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListAppsResponseBody {
    pub data: ListAppsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListFilesRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesRequestBody {
    pub file_group_id: FileGroupId,
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort: Option<ListFilesSorting>,
}


// ApiResponse_CreateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateFileResponseBody {
    pub data: CreateFileResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_GetAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetAppsResponseBody {
    pub data: GetAppsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_UpdateFileGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateFileGroupResponseBody {
    pub data: UpdateFileGroupResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_GetUsersResBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetUsersResBody {
    pub data: GetUsersResBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_UpdateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateUserGroupResponseBody {
    pub data: UpdateUserGroupResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// FilezUserType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilezUserType {
    SuperAdmin,
    Regular,
    KeyAccess
}


// GetTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetTagsResponseBody {
    pub resource_tags: HashMap<Uuid, HashMap<String, String>>,
}


// GetUserGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUserGroupsRequestBody {
    pub user_group_ids: Vec<UserGroupId>,
}


// JobStatusDetailsCompleted
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCompleted {
    pub message: String,
}


// ListAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAppsResponseBody {
    pub apps: Vec<MowsApp>,
}


// UpdateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAccessPolicyResponseBody {
    pub updated_access_policy: AccessPolicy,
}


// CreateUserResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserResponseBody {
    pub created_user: FilezUser,
}


// FileVersionSizeExceededErrorBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersionSizeExceededErrorBody {
    pub allowed: u64,
    pub received: u64,
}


// UpdateFileGroupMembersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupMembersRequestBody {
    pub file_group_id: FileGroupId,
    pub files_to_add: Vec<FilezFileId>,
    pub files_to_remove: Vec<FilezFileId>,
}


// UpdateUserGroupMembersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupMembersRequestBody {
    pub user_group_id: UserGroupId,
    pub users_to_add: Vec<FilezUserId>,
    pub users_to_remove: Vec<FilezUserId>,
}


// UserGroup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserGroup {
    pub created_time: NaiveDateTime,
    pub id: UserGroupId,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: FilezUserId,
}


// ApiResponse_CreateFileVersionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateFileVersionResponseBody {
    pub data: CreateFileVersionResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// GetStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaRequestBody {
    pub storage_quota_ids: Vec<StorageQuotaId>,
}


// GetFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileGroupsResponseBody {
    pub file_groups: Vec<FileGroup>,
}


// JobStatusDetailsInProgress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsInProgress {
    pub message: String,
}


// GetAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAccessPolicyResponseBody {
    pub access_policies: Vec<AccessPolicy>,
}


// UpdateJobStatusResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobStatusResponseBody {
    pub updated_job: FilezJob,
}


// DeleteUserMethod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeleteUserMethod {
    ById(FilezUserId),
    ByExternalId(String),
    ByEmail(String)
}


// DeleteUserRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteUserRequestBody {
    pub delete_user_method: DeleteUserMethod,
}


// FileVersionId
pub type FileVersionId = Uuid;


// JobStatusDetailsFailed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsFailed {
    pub error: Option<String>,
    pub message: String,
}


// FilezFileId
pub type FilezFileId = Uuid;


// JobStatusDetailsCancelled
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCancelled {
    pub message: String,
    pub reason: Option<String>,
}


// UpdateJobStatusRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobStatusRequestBody {
    pub new_job_status_details: Option<JobStatusDetails>,
    pub new_status: JobStatus,
}


// UpdateFileGroupChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupChangeset {
    pub new_file_group_name: Option<String>,
}


// ApiResponse_HealthResBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseHealthResBody {
    pub data: HealthResBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// EmptyApiResponse
pub type EmptyApiResponse=serde_json::Value;


// FileVersion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersion {
    pub app_id: MowsAppId,
    pub app_path: String,
    pub content_expected_sha256_digest: Option<String>,
    pub content_valid: bool,
    pub created_time: NaiveDateTime,
    pub file_id: FilezFileId,
    pub id: FileVersionId,
    pub metadata: FileVersionMetadata,
    pub mime_type: String,
    pub modified_time: NaiveDateTime,
    pub size: i64,
    pub storage_location_id: StorageLocationId,
    pub storage_quota_id: StorageQuotaId,
    pub version: i32,
}


// GetAccessPolicyRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAccessPolicyRequestBody {
    pub access_policy_ids: Vec<AccessPolicyId>,
}


// ApiResponse_FileVersionSizeExceededErrorBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseFileVersionSizeExceededErrorBody {
    pub data: FileVersionSizeExceededErrorBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// FileMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub default_preview_app_id: Option<MowsAppId>,
    pub extracted_data: Value,
    pub private_app_data: Value,
    pub shared_app_data: Value,
}


// AccessPolicyId
pub type AccessPolicyId = Uuid;


// ListJobsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListJobsSortBy {
    Name,
    CreatedTime,
    ModifiedTime
}


// ListUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUsersResponseBody {
    pub total_count: u64,
    pub users: Vec<FilezUser>,
}


// CreateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAccessPolicyResponseBody {
    pub created_access_policy: AccessPolicy,
}


// UpdateFileChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileChangeset {
    pub new_file_metadata: Option<FileMetadata>,
    pub new_file_mime_type: Option<String>,
    pub new_file_name: Option<String>,
}


// UpdateJobChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobChangeset {
    pub new_job_deadline_time: Option<String>,
    pub new_job_execution_information: Option<JobExecutionInformation>,
    pub new_job_name: Option<String>,
    pub new_job_persistence: Option<JobPersistenceType>,
}


// ApiResponse_ListUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListUserGroupsResponseBody {
    pub data: ListUserGroupsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// JobStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobStatus {
    Created,
    InProgress,
    Completed,
    Failed,
    Cancelled
}


// PickupJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickupJobRequestBody {
    
}


// ApiResponse_UpdateJobStatusResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateJobStatusResponseBody {
    pub data: UpdateJobStatusResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_ListUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListUsersResponseBody {
    pub data: ListUsersResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_UpdateFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateFileVersionsResponseBody {
    pub data: UpdateFileVersionsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_CheckResourceAccessResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCheckResourceAccessResponseBody {
    pub data: CheckResourceAccessResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_GetJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetJobResponseBody {
    pub data: GetJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// JobType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobType {
    CreatePreview(JobTypeCreatePreview)
}


// UpdateFileVersionsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionsRequestBody {
    pub changeset: UpdateFileVersionChangeset,
    pub file_version_id: FileVersionId,
}


// UpdateUserGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupRequestBody {
    pub changeset: UpdateUserGroupChangeset,
    pub user_group_id: UserGroupId,
}


// ListAccessPoliciesSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListAccessPoliciesSortBy {
    CreatedTime,
    ModifiedTime,
    Name
}


// ListUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUserGroupsResponseBody {
    pub user_groups: Vec<UserGroup>,
}


// ApiResponse_GetOwnUserBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetOwnUserBody {
    pub data: GetOwnUserBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListUsersSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListUsersSortBy {
    CreatedTime,
    ModifiedTime,
    Name
}


// ApiResponse_UpdateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateAccessPolicyResponseBody {
    pub data: UpdateAccessPolicyResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// UpdateFileRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileRequestBody {
    pub changeset: UpdateFileChangeset,
    pub file_id: FilezFileId,
}


// JobPersistenceType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobPersistenceType {
    Temporary,
    Persistent
}


// CreateFileRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileRequestBody {
    pub file_name: String,
    pub mime_type: Option<String>,
    pub time_created: Option<String>,
    pub time_modified: Option<String>,
}


// ApiResponseStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApiResponseStatus {
    Success,
    Error(String)
}


// UpdateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileResponseBody {
    pub updated_file: FilezFile,
}


// CreateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStorageQuotaResponseBody {
    pub created_storage_quota: StorageQuota,
}


// CreateUserGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserGroupRequestBody {
    pub user_group_name: String,
}


// JobStatusDetails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobStatusDetails {
    Created(JobStatusDetailsCreated),
    InProgress(JobStatusDetailsInProgress),
    Completed(JobStatusDetailsCompleted),
    Failed(JobStatusDetailsFailed),
    Cancelled(JobStatusDetailsCancelled)
}


// JobTypeCreatePreview
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobTypeCreatePreview {
    pub allowed_mime_types: Vec<String>,
    pub allowed_number_of_previews: u32,
    pub allowed_size_bytes: u64,
    pub file_id: FilezFileId,
    pub file_version_number: u32,
    pub preview_config: Value,
    pub storage_location_id: StorageLocationId,
    pub storage_quota_id: StorageQuotaId,
}


// UpdateFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionsResponseBody {
    pub updated_file_version: FileVersion,
}


// AccessPolicyResourceType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicyResourceType {
    File,
    FileGroup,
    User,
    UserGroup,
    StorageLocation,
    AccessPolicy,
    StorageQuota,
    FilezJob,
    App
}


// ListedFilezUser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListedFilezUser {
    pub created_time: NaiveDateTime,
    pub display_name: String,
    pub id: FilezUserId,
}


// UpdateFileGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupResponseBody {
    pub updated_file_group: FileGroup,
}


// UpdateStorageQuotaChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorageQuotaChangeset {
    pub new_storage_quota_bytes: Option<i64>,
}


// FileGroupId
pub type FileGroupId = Uuid;


// UpdateStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorageQuotaRequestBody {
    pub changeset: UpdateStorageQuotaChangeset,
    pub storage_quota_id: StorageQuotaId,
}


// ApiResponse_UpdateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateFileResponseBody {
    pub data: UpdateFileResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// SortDirection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    Ascending,
    Descending
}


// AccessPolicySubjectType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicySubjectType {
    User,
    UserGroup,
    ServerMember,
    Public
}


// GetOwnUserBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetOwnUserBody {
    pub user: FilezUser,
}


// GetTagsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetTagsRequestBody {
    pub resource_ids: Vec<Uuid>,
    pub tag_resource_type: TagResourceType,
}


// ApiResponse_CreateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateUserGroupResponseBody {
    pub data: CreateUserGroupResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_GetAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetAccessPolicyResponseBody {
    pub data: GetAccessPolicyResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// CreateStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStorageQuotaRequestBody {
    pub storage_location_id: StorageLocationId,
    pub storage_quota_bytes: u64,
    pub storage_quota_name: String,
    pub storage_quota_subject_id: StorageQuotaSubjectId,
    pub storage_quota_subject_type: StorageQuotaSubjectType,
}


// FilezUserId
pub type FilezUserId = Uuid;


// JobExecutionInformation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobExecutionInformation {
    pub job_type: JobType,
}


// CreateAccessPolicyRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAccessPolicyRequestBody {
    pub access_policy_actions: Vec<AccessPolicyAction>,
    pub access_policy_effect: AccessPolicyEffect,
    pub access_policy_name: String,
    pub access_policy_resource_type: AccessPolicyResourceType,
    pub access_policy_subject_id: AccessPolicySubjectId,
    pub access_policy_subject_type: AccessPolicySubjectType,
    pub context_app_ids: Vec<MowsAppId>,
    pub resource_id: Option<String>,
}


// CreateJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJobRequestBody {
    pub job_deadline_time: Option<String>,
    pub job_execution_details: JobExecutionInformation,
    pub job_handling_app_id: MowsAppId,
    pub job_name: String,
    pub job_persistence: JobPersistenceType,
}

