// This file is auto-generated from OpenAPI specification
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

// UpdateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobResponseBody {
    pub job: FilezJob,
}

// AuthReason
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthReason {
    SuperAdmin,
    Owned,
    AllowedByPubliclyAccessible {
        policy_id: AccessPolicyId,
    },
    AllowedByServerAccessible {
        policy_id: AccessPolicyId,
    },
    AllowedByDirectUserPolicy {
        policy_id: AccessPolicyId,
    },
    AllowedByDirectUserGroupPolicy {
        policy_id: AccessPolicyId,
        via_user_group_id: UserGroupId,
    },
    AllowedByResourceGroupUserPolicy {
        on_resource_group_id: Uuid,
        policy_id: AccessPolicyId,
    },
    AllowedByResourceGroupUserGroupPolicy {
        on_resource_group_id: Uuid,
        policy_id: AccessPolicyId,
        via_user_group_id: UserGroupId,
    },
    DeniedByPubliclyAccessible {
        policy_id: AccessPolicyId,
    },
    DeniedByServerAccessible {
        policy_id: AccessPolicyId,
    },
    DeniedByDirectUserPolicy {
        policy_id: AccessPolicyId,
    },
    DeniedByDirectUserGroupPolicy {
        policy_id: AccessPolicyId,
        via_user_group_id: UserGroupId,
    },
    DeniedByResourceGroupUserPolicy {
        on_resource_group_id: Uuid,
        policy_id: AccessPolicyId,
    },
    DeniedByResourceGroupUserGroupPolicy {
        on_resource_group_id: Uuid,
        policy_id: AccessPolicyId,
        via_user_group_id: UserGroupId,
    },
    NoMatchingAllowPolicy,
    ResourceNotFound,
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

// ApiResponse_CreateFileVersionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateFileVersionResponseBody {
    pub data: CreateFileVersionResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// StorageQuotaSubjectId
pub type StorageQuotaSubjectId = Uuid;

// UpdateAccessPolicyChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAccessPolicyChangeset {
    pub new_access_policy_actions: Option<Vec<AccessPolicyAction>>,
    pub new_access_policy_effect: Option<AccessPolicyEffect>,
    pub new_access_policy_name: Option<String>,
    pub new_access_policy_resource_type: Option<AccessPolicyResourceType>,
    pub new_access_policy_subject_id: Option<AccessPolicySubjectId>,
    pub new_access_policy_subject_type: Option<AccessPolicySubjectType>,
    pub new_context_app_ids: Option<Vec<MowsAppId>>,
    pub new_resource_id: Option<String>,
}

// ListJobsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListJobsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListJobsSortBy>,
    pub sort_order: Option<SortDirection>,
}

// ListFileGroupsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFileGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}

// AppType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppType {
    #[serde(rename = "frontend")]
    Frontend,
    #[serde(rename = "backend")]
    Backend,
}

// UpdateFileVersionChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionChangeset {
    pub new_content_expected_sha256_digest: Option<String>,
    pub new_file_version_metadata: Option<FileVersionMetadata>,
    pub new_file_version_mime_type: Option<String>,
}

// FilezUserType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilezUserType {
    SuperAdmin,
    Regular,
    KeyAccess,
}

// UpdateJobStatusResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobStatusResponseBody {
    pub updated_job: FilezJob,
}

// DeleteUserRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteUserRequestBody {
    pub delete_user_method: DeleteUserMethod,
}

// GetUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUserGroupsResponseBody {
    pub user_groups: Vec<UserGroup>,
}

// FilezUserId
pub type FilezUserId = Uuid;

// ListTagResult
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTagResult {
    pub resource_type: TagResourceType,
    pub tag_key: String,
    pub tag_value: String,
    pub usage_count: u64,
}

// ListTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTagsResponseBody {
    pub tags: Vec<ListTagResult>,
    pub total_count: u64,
}

// ApiResponseStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApiResponseStatus {
    Success,
    Error(String),
}

// ApiResponse_UpdateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateAccessPolicyResponseBody {
    pub data: UpdateAccessPolicyResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
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

// FileVersionSizeExceededErrorBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersionSizeExceededErrorBody {
    pub allowed: u64,
    pub received: u64,
}

// GetAppsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAppsRequestBody {
    pub app_ids: Vec<MowsAppId>,
}

// ApiResponse_GetFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetFileGroupsResponseBody {
    pub data: GetFileGroupsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
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
    MowsApp,
}

// GetFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileGroupsResponseBody {
    pub file_groups: Vec<FileGroup>,
}

// ListAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAppsResponseBody {
    pub apps: Vec<MowsApp>,
}

// ListTagsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTagsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub resource_type: TagResourceType,
    pub search: Option<ListTagsSearch>,
    pub sort_by: Option<ListTagsSortBy>,
    pub sort_order: Option<SortDirection>,
}

// CreateFileVersionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileVersionResponseBody {
    pub created_file_version: FileVersion,
}

// CreateFileRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileRequestBody {
    pub file_name: String,
    pub mime_type: Option<String>,
    pub time_created: Option<String>,
    pub time_modified: Option<String>,
}

// JobExecutionInformation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobExecutionInformation {
    pub job_type: JobType,
}

// ApiResponse_CreateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateFileResponseBody {
    pub data: CreateFileResponseBody,
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

// GetUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUsersResponseBody {
    pub users_meta: HashMap<Uuid, UserMeta>,
}

// ListFilesStoredSortOrder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesStoredSortOrder {
    pub direction: Option<SortDirection>,
    pub stored_sort_order_id: Uuid,
}

// ListTagsSearch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTagsSearch {
    pub plain_string: Option<String>,
    pub search_context: Option<ListTagsSearchContext>,
    pub tag_key: Option<String>,
    pub tag_value: Option<String>,
}

// UpdateStorageQuotaChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorageQuotaChangeset {
    pub new_storage_quota_bytes: Option<i64>,
}

// UserGroupId
pub type UserGroupId = Uuid;

// GetFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFilesResponseBody {
    pub files: Vec<FilezFile>,
}

// UpdateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupResponseBody {
    pub updated_user_group: UserGroup,
}

// AccessPolicySubjectType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicySubjectType {
    User,
    UserGroup,
    ServerMember,
    Public,
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

// AccessPolicyId
pub type AccessPolicyId = Uuid;

// GetFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileVersionsResponseBody {
    pub file_versions: Vec<FileVersion>,
}

// JobTypeExtractMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobTypeExtractMetadata {
    pub extract_metadata_config: Value,
    pub file_id: FilezFileId,
    pub file_version_number: u32,
}

// PickupJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickupJobRequestBody {}

// ListJobsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListJobsResponseBody {
    pub jobs: Vec<FilezJob>,
    pub total_count: u64,
}

// ListStorageQuotasResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageQuotasResponseBody {
    pub storage_quotas: Vec<StorageQuota>,
    pub total_count: u64,
}

// GetStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaResponseBody {
    pub storage_quotas: Vec<StorageQuota>,
}

// StartSessionRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartSessionRequestBody {}

// UpdateFileGroupMembersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupMembersRequestBody {
    pub file_group_id: FileGroupId,
    pub files_to_add: Option<Vec<FilezFileId>>,
    pub files_to_remove: Option<Vec<FilezFileId>>,
}

// HealthStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub message: String,
}

// ApiResponse_GetOwnUserBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetOwnUserBody {
    pub data: GetOwnUserBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// FileVersionId
pub type FileVersionId = Uuid;

// ApiResponse_UpdateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateFileResponseBody {
    pub data: UpdateFileResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ListStorageLocationsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListStorageLocationsSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
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

// ApiResponse_GetUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetUsersResponseBody {
    pub data: GetUsersResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// CreateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserGroupResponseBody {
    pub created_user_group: UserGroup,
}

// JobStatusDetailsFailed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsFailed {
    pub error: Option<String>,
    pub message: String,
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

// EmptyApiResponse
pub type EmptyApiResponse = serde_json::Value;

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

// ApiResponse_UpdateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateJobResponseBody {
    pub data: UpdateJobResponseBody,
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

// DatabaseHealthDetails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseHealthDetails {
    pub connection_count: Option<i64>,
    pub database_size: Option<i64>,
    pub error: Option<String>,
    pub latency_ms: Option<u64>,
    pub max_connections: Option<i32>,
    pub pool_status: Option<PoolStatus>,
    pub reachable: bool,
    pub version: Option<String>,
}

// FileVersionMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersionMetadata {}

// JobStatusDetails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobStatusDetails {
    Created(JobStatusDetailsCreated),
    InProgress(JobStatusDetailsInProgress),
    Completed(JobStatusDetailsCompleted),
    Failed(JobStatusDetailsFailed),
    Cancelled(JobStatusDetailsCancelled),
}

// GetAccessPolicyRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAccessPolicyRequestBody {
    pub access_policy_ids: Vec<AccessPolicyId>,
}

// ApiResponse_ListUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListUsersResponseBody {
    pub data: ListUsersResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ControllerHealthDetails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControllerHealthDetails {
    pub crd_error: Option<String>,
    pub crd_installed: bool,
    pub kubernetes_error: Option<String>,
    pub kubernetes_reachable: bool,
    pub last_reconcile_event: Option<String>,
    pub reconcile_loop_running: bool,
    pub reconcile_stale: bool,
}

// ApiResponse_String
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseString {
    pub data: String,
    pub message: String,
    pub status: ApiResponseStatus,
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

// ApiResponse_CreateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateStorageQuotaResponseBody {
    pub data: CreateStorageQuotaResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// CreateUserResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserResponseBody {
    pub created_user: FilezUser,
}

// JobStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobStatus {
    Created,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

// ApiResponse_GetUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetUserGroupsResponseBody {
    pub data: GetUserGroupsResponseBody,
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

// JobStatusDetailsCompleted
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCompleted {
    pub message: String,
}

// ListAccessPoliciesRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAccessPoliciesRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListAccessPoliciesSortBy>,
    pub sort_order: Option<SortDirection>,
}

// ListAccessPoliciesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAccessPoliciesResponseBody {
    pub access_policies: Vec<AccessPolicy>,
    pub total_count: u64,
}

// ListFileGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFileGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListFileGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}

// CreateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStorageQuotaResponseBody {
    pub created_storage_quota: StorageQuota,
}

// ListUserGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUserGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListUserGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}

// ApiResponse_StartSessionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseStartSessionResponseBody {
    pub data: StartSessionResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
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

// ApiResponse_ListTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListTagsResponseBody {
    pub data: ListTagsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// GetTagsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetTagsRequestBody {
    pub resource_ids: Vec<Uuid>,
    pub tag_resource_type: TagResourceType,
}

// ApiResponse_EndSessionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseEndSessionResponseBody {
    pub data: EndSessionResponseBody,
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

// AccessPolicySubjectId
pub type AccessPolicySubjectId = Uuid;

// ApiResponse_UpdateJobStatusResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateJobStatusResponseBody {
    pub data: UpdateJobStatusResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ListStorageLocationsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageLocationsRequestBody {
    pub sort_by: Option<ListStorageLocationsSortBy>,
    pub sort_order: Option<SortDirection>,
}

// StartSessionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartSessionResponseBody {}

// ApiResponse_ListAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListAppsResponseBody {
    pub data: ListAppsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// GetAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAppsResponseBody {
    pub apps: HashMap<Uuid, MowsApp>,
}

// EndSessionRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndSessionRequestBody {}

// FileMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub default_preview_app_id: Option<MowsAppId>,
    pub extracted_data: Value,
    pub private_app_data: Value,
    pub shared_app_data: Value,
}

// ApiResponse_GetAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetAppsResponseBody {
    pub data: GetAppsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// PickupJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickupJobResponseBody {
    pub job: Option<FilezJob>,
}

// ListStorageQuotasSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListStorageQuotasSortBy {
    CreatedTime,
    ModifiedTime,
    SubjectType,
    SubjectId,
    StorageLocationId,
}

// UpdateFileChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileChangeset {
    pub new_file_metadata: Option<FileMetadata>,
    pub new_file_mime_type: Option<String>,
    pub new_file_name: Option<String>,
}

// ListUsersSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListUsersSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
}

// ListFilesRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesRequestBody {
    pub file_group_id: FileGroupId,
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort: Option<ListFilesSorting>,
}

// ApiResponse_GetStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetStorageQuotaResponseBody {
    pub data: GetStorageQuotaResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// StorageQuotaId
pub type StorageQuotaId = Uuid;

// ApiResponse_ListFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListFileGroupsResponseBody {
    pub data: ListFileGroupsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// GetUsersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUsersRequestBody {
    pub user_ids: Vec<FilezUserId>,
}

// StorageQuotaSubjectType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StorageQuotaSubjectType {
    User,
    UserGroup,
}

// GetFilesRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFilesRequestBody {
    pub file_ids: Vec<FilezFileId>,
}

// FileVersion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersion {
    pub app_id: MowsAppId,
    pub app_path: String,
    pub content_expected_sha256_digest: Option<String>,
    pub content_valid: bool,
    pub created_time: NaiveDateTime,
    pub existing_content_bytes: Option<i64>,
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

// FileGroupType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileGroupType {
    Manual,
    Dynamic,
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

// UpdateFileGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupRequestBody {
    pub changeset: UpdateFileGroupChangeset,
    pub file_group_id: FileGroupId,
}

// MowsApp
/// # Backend Apps
/// Pods can authenticate as apps using their Kubernetes service account token
/// Backend apps can act on behalf of users by picking up jobs created by users
/// # Frontend Apps
/// Frontend Apps are recognized by their origin that is sent with the browser request
/// They can act on behalf of users if an access policy allows it
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MowsApp {
    pub app_type: AppType,
    pub created_time: NaiveDateTime,
    pub description: Option<String>,
    pub id: MowsAppId,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub origins: Option<Vec<String>>,
    pub trusted: bool,
}

// ApiResponse_GetStorageQuotaUsageResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetStorageQuotaUsageResponseBody {
    pub data: GetStorageQuotaUsageResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// GetFileVersionsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileVersionsRequestBody {
    pub file_version_ids: Vec<FileVersionId>,
}

// UpdateFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionsResponseBody {
    pub updated_file_version: FileVersion,
}

// CreateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJobResponseBody {
    pub created_job: FilezJob,
}

// ApiResponse_PickupJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponsePickupJobResponseBody {
    pub data: PickupJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// JobStatusDetailsCreated
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCreated {
    pub message: String,
}

// JobPersistenceType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobPersistenceType {
    Temporary,
    Persistent,
}

// ApiResponse_UpdateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateStorageQuotaResponseBody {
    pub data: UpdateStorageQuotaResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// DynamicGroupRule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicGroupRule {}

// ListUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUsersResponseBody {
    pub total_count: u64,
    pub users: Vec<FilezUser>,
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

// UpdateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAccessPolicyResponseBody {
    pub updated_access_policy: AccessPolicy,
}

// MowsAppId
pub type MowsAppId = Uuid;

// ListStorageQuotasRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageQuotasRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListStorageQuotasSortBy>,
    pub sort_order: Option<SortDirection>,
}

// UpdateJobStatusRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobStatusRequestBody {
    pub new_job_status_details: Option<JobStatusDetails>,
    pub new_status: JobStatus,
}

// ProgressStep
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressStep {
    pub completed: bool,
    pub description: Option<String>,
    pub name: String,
}

// JobTypeCreatePreview
/// Allows the app to create a set of previews for a existing file_version_number and file_id
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

// GetStorageQuotaUsageResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaUsageResponseBody {
    pub storage_quota: StorageQuota,
    pub used_bytes: u64,
}

// GetAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAccessPolicyResponseBody {
    pub access_policies: Vec<AccessPolicy>,
}

// ListStorageLocationsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageLocationsResponseBody {
    pub storage_locations: Vec<StorageLocationListItem>,
}

// ApiResponse_ListJobsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListJobsResponseBody {
    pub data: ListJobsResponseBody,
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

// UpdateFileRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileRequestBody {
    pub changeset: UpdateFileChangeset,
    pub file_id: FilezFileId,
}

// UpdateUserGroupChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupChangeset {
    pub new_user_group_name: Option<String>,
}

// EndSessionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndSessionResponseBody {}

// ListFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesResponseBody {
    pub files: Vec<FilezFile>,
    pub total_count: u64,
}

// ControllerHealthStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControllerHealthStatus {
    pub details: Option<ControllerHealthDetails>,
    pub healthy: bool,
    pub response: String,
}

// GetOwnUserBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetOwnUserBody {
    pub user: FilezUser,
}

// UpdateFileGroupChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupChangeset {
    pub new_file_group_name: Option<String>,
}

// ApiResponse_GetJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetJobResponseBody {
    pub data: GetJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// UpdateJobChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobChangeset {
    pub new_job_deadline_time: Option<String>,
    pub new_job_execution_information: Option<JobExecutionInformation>,
    pub new_job_name: Option<String>,
    pub new_job_persistence: Option<JobPersistenceType>,
}

// CreateFileGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileGroupResponseBody {
    pub created_file_group: FileGroup,
}

// DevResetDatabaseRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevResetDatabaseRequestBody {}

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
    FilezAppsList,
}

// JobStatusDetailsCancelled
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCancelled {
    pub message: String,
    pub reason: Option<String>,
}

// JobType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobType {
    CreatePreview(JobTypeCreatePreview),
    ExtractMetadata(JobTypeExtractMetadata),
}

// SortDirection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    Ascending,
    Descending,
    Neutral,
}

// DatabaseHealthStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseHealthStatus {
    pub details: Option<DatabaseHealthDetails>,
    pub healthy: bool,
    pub message: String,
}

// ApiResponse_ListUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListUserGroupsResponseBody {
    pub data: ListUserGroupsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// FilezJobId
pub type FilezJobId = Uuid;

// StorageLocationId
pub type StorageLocationId = Uuid;

// UpdateUserGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupRequestBody {
    pub changeset: UpdateUserGroupChangeset,
    pub user_group_id: UserGroupId,
}

// ApiResponse_ListStorageLocationsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListStorageLocationsResponseBody {
    pub data: ListStorageLocationsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// CheckResourceAccessRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResourceAccessRequestBody {
    pub access_policy_action: AccessPolicyAction,
    pub access_policy_resource_type: AccessPolicyResourceType,
    pub requesting_app_origin: Option<String>,
    pub resource_ids: Option<Vec<Uuid>>,
}

// GetJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetJobResponseBody {
    pub job: FilezJob,
}

// CreateUserRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserRequestBody {
    pub email: String,
}

// ListFilesSorting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFilesSorting {
    StoredSortOrder(ListFilesStoredSortOrder),
    SortOrder(ListFilesSortOrder),
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

// UpdateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorageQuotaResponseBody {
    pub updated_storage_quota: StorageQuota,
}

// DeleteUserMethod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeleteUserMethod {
    ById(FilezUserId),
    ByExternalId(String),
    ByEmail(String),
}

// PoolStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStatus {
    pub available: i64,
    pub max_size: i64,
    pub size: i64,
}

// CheckResourceAccessResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResourceAccessResponseBody {
    pub auth_evaluations: Vec<AuthEvaluation>,
}

// GetStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaRequestBody {
    pub storage_quota_ids: Vec<StorageQuotaId>,
}

// UpdateTagsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTagsRequestBody {
    pub resource_ids: Vec<Uuid>,
    pub tag_resource_type: TagResourceType,
    pub update_tags: UpdateTagsMethod,
}

// ListFilesSortOrder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesSortOrder {
    pub sort_by: ListFilesSortBy,
    pub sort_order: Option<SortDirection>,
}

// CreateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAccessPolicyResponseBody {
    pub created_access_policy: AccessPolicy,
}

// ApiResponse_UpdateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateUserGroupResponseBody {
    pub data: UpdateUserGroupResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// CreateUserGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserGroupRequestBody {
    pub user_group_name: String,
}

// ApiResponse_FileVersionSizeExceededErrorBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseFileVersionSizeExceededErrorBody {
    pub data: FileVersionSizeExceededErrorBody,
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

// GetUserGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUserGroupsRequestBody {
    pub user_group_ids: Vec<UserGroupId>,
}

// ApiResponse_CreateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateUserGroupResponseBody {
    pub data: CreateUserGroupResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// UpdateAccessPolicyRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAccessPolicyRequestBody {
    pub access_policy_id: AccessPolicyId,
    pub changeset: UpdateAccessPolicyChangeset,
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

// ApiResponse_ListFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListFilesResponseBody {
    pub data: ListFilesResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// CreateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileResponseBody {
    pub created_file: FilezFile,
}

// UpdateTagsMethod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UpdateTagsMethod {
    Add(HashMap<String, String>),
    Remove(HashMap<String, String>),
    Set(HashMap<String, String>),
    Clear,
}

// UpdateStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorageQuotaRequestBody {
    pub changeset: UpdateStorageQuotaChangeset,
    pub storage_quota_id: StorageQuotaId,
}

// StorageLocationListItem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageLocationListItem {
    pub created_time: NaiveDateTime,
    pub id: StorageLocationId,
    pub modified_time: NaiveDateTime,
    pub name: String,
}

// UpdateUserGroupMembersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupMembersRequestBody {
    pub user_group_id: UserGroupId,
    pub users_to_add: Option<Vec<FilezUserId>>,
    pub users_to_remove: Option<Vec<FilezUserId>>,
}

// CreateFileGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileGroupRequestBody {
    pub dynamic_group_rule: Option<DynamicGroupRule>,
    pub file_group_name: String,
    pub file_group_type: FileGroupType,
}

// ListAccessPoliciesSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListAccessPoliciesSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
}

// HealthResBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResBody {
    pub all_healthy: bool,
    pub controller: ControllerHealthStatus,
    pub database: DatabaseHealthStatus,
    pub storage_locations: HashMap<Uuid, HealthStatus>,
    pub zitadel: HealthStatus,
}

// ApiResponse_EmptyApiResponse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseEmptyApiResponse {
    pub data: EmptyApiResponse,
    pub message: String,
    pub status: ApiResponseStatus,
}

// UpdateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileResponseBody {
    pub updated_file: FilezFile,
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
    StorageQuota,
}

// GetFileGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileGroupsRequestBody {
    pub file_group_ids: Vec<FileGroupId>,
}

// ListUserGroupsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListUserGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}

// GetJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetJobRequestBody {
    pub job_id: FilezJobId,
}

// JobStatusDetailsInProgress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsInProgress {
    pub message: String,
    pub steps: Option<Vec<ProgressStep>>,
}

// FileGroupId
pub type FileGroupId = Uuid;

// UpdateJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobRequestBody {
    pub changeset: UpdateJobChangeset,
    pub job_id: FilezJobId,
}

// ApiResponse_CreateFileGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateFileGroupResponseBody {
    pub data: CreateFileGroupResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// FilezFileId
pub type FilezFileId = Uuid;

// UserMeta
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMeta {
    pub user: FilezUser,
}

// ApiResponse_GetTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetTagsResponseBody {
    pub data: GetTagsResponseBody,
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

// AccessPolicyEffect
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicyEffect {
    Deny,
    Allow,
}

// ApiResponse_HealthResBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseHealthResBody {
    pub data: HealthResBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ListFilesSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFilesSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}

// ApiResponse_CreateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateJobResponseBody {
    pub data: CreateJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ListTagsSearchContext
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTagsSearchContext {
    pub resource_ids: Vec<Uuid>,
}

// ApiResponse_ListAccessPoliciesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListAccessPoliciesResponseBody {
    pub data: ListAccessPoliciesResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_CreateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateAccessPolicyResponseBody {
    pub data: CreateAccessPolicyResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// UpdateFileVersionsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionsRequestBody {
    pub changeset: UpdateFileVersionChangeset,
    pub file_version_id: FileVersionId,
}

// GetStorageQuotaUsageRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaUsageRequestBody {
    pub storage_quota_id: StorageQuotaId,
}

// ListJobsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListJobsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}

// ListTagsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListTagsSortBy {
    TagKey,
    TagValue,
    UsageCount,
    CreatedTime,
    ModifiedTime,
}

// GetTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetTagsResponseBody {
    pub resource_tags: HashMap<Uuid, HashMap<String, String>>,
}

// ListAppsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAppsRequestBody {}

// AuthEvaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthEvaluation {
    pub is_allowed: bool,
    pub reason: AuthReason,
    pub resource_id: Option<String>,
}

// ListFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFileGroupsResponseBody {
    pub file_groups: Vec<FileGroup>,
    pub total_count: u64,
}

// ListUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUserGroupsResponseBody {
    pub total_count: u64,
    pub user_groups: Vec<UserGroup>,
}

// ApiResponse_GetFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetFileVersionsResponseBody {
    pub data: GetFileVersionsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}
