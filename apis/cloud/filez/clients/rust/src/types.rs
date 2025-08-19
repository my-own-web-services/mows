// This file is auto-generated from OpenAPI specification
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use chrono::NaiveDateTime;
use std::collections::HashMap;

// ApiResponse_CreateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateJobResponseBody {
    pub data: CreateJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_FileGroup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseFileGroup {
    pub data: FileGroup,
    pub message: String,
    pub status: ApiResponseStatus,
}


// CreateUserGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserGroupRequestBody {
    pub name: String,
}


// ListAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAppsResponseBody {
    pub apps: Vec<MowsApp>,
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


// FilezFile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilezFile {
    pub created_time: NaiveDateTime,
    pub id: Uuid,
    pub metadata: FileMetadata,
    pub mime_type: String,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: Uuid,
}


// UpdateTagsMethod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UpdateTagsMethod {
    Add(HashMap<String, String>),
    Remove(HashMap<String, String>),
    Set(HashMap<String, String>),
    Clear
}


// ApiResponse_CreateUserResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateUserResponseBody {
    pub data: CreateUserResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_UpdateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateJobResponseBody {
    pub data: UpdateJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// DeleteJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteJobRequestBody {
    pub job_id: Uuid,
}


// UserGroup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserGroup {
    pub created_time: NaiveDateTime,
    pub id: Uuid,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: Uuid,
}


// JobStatusDetailsInProgress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsInProgress {
    pub message: String,
}


// ApiResponse_ListFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListFilesResponseBody {
    pub data: ListFilesResponseBody,
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


// JobStatusDetailsCompleted
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCompleted {
    pub message: String,
}


// StorageLocationListItem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageLocationListItem {
    pub created_time: NaiveDateTime,
    pub id: Uuid,
    pub modified_time: NaiveDateTime,
    pub name: String,
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


// JobTypeCreatePreview
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobTypeCreatePreview {
    pub allowed_mime_types: Vec<String>,
    pub allowed_number_of_previews: u32,
    pub allowed_size_bytes: u64,
    pub file_id: Uuid,
    pub file_version_number: u32,
    pub preview_config: Value,
    pub storage_location_id: Uuid,
    pub storage_quota_id: Uuid,
}


// AccessPolicySubjectType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicySubjectType {
    User,
    UserGroup,
    ServerMember,
    Public
}


// ApiResponseStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApiResponseStatus {
    Success,
    Error(String)
}


// ApiResponse_CheckResourceAccessResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCheckResourceAccessResponseBody {
    pub data: CheckResourceAccessResponseBody,
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


// ListUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUsersResponseBody {
    pub total_count: u64,
    pub users: Vec<FilezUser>,
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


// UpdateFileGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupRequestBody {
    pub file_group_id: Uuid,
    pub name: String,
}


// ApiResponse_ListAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListAppsResponseBody {
    pub data: ListAppsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_GetFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetFileVersionsResponseBody {
    pub data: GetFileVersionsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// UpdateFileRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileRequestBody {
    pub file_id: Uuid,
    pub file_name: Option<String>,
    pub metadata: Option<FileMetadata>,
    pub mime_type: Option<String>,
}


// ListFilesStoredSortOrder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesStoredSortOrder {
    pub id: Uuid,
    pub sort_order: Option<SortDirection>,
}


// UpdateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobResponseBody {
    pub job: FilezJob,
}


// ListFileGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFileGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListFileGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}


// FileGroupType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileGroupType {
    Manual,
    Dynamic
}


// CreateAccessPolicyRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAccessPolicyRequestBody {
    pub actions: Vec<AccessPolicyAction>,
    pub context_app_ids: Vec<Uuid>,
    pub effect: AccessPolicyEffect,
    pub name: String,
    pub resource_id: Option<String>,
    pub resource_type: AccessPolicyResourceType,
    pub subject_id: Uuid,
    pub subject_type: AccessPolicySubjectType,
}


// CreateFileVersionRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileVersionRequestBody {
    pub app_path: Option<String>,
    pub content_expected_sha256_digest: Option<String>,
    pub file_id: Uuid,
    pub metadata: FileVersionMetadata,
    pub mime_type: String,
    pub size: u64,
    pub storage_quota_id: Uuid,
    pub version: Option<u32>,
}


// GetFileVersionsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileVersionsRequestBody {
    pub versions: Vec<FileVersionIdentifier>,
}


// ListUserGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUserGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListUserGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}


// FileVersionIdentifier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersionIdentifier {
    pub app_id: Uuid,
    pub app_path: String,
    pub file_id: Uuid,
    pub version: u32,
}


// DeleteFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteFileResponseBody {
    pub file_id: Uuid,
}


// ApiResponse_EmptyApiResponse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseEmptyApiResponse {
    pub data: EmptyApiResponse,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_CreateFileVersionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateFileVersionResponseBody {
    pub data: CreateFileVersionResponseBody,
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


// DeleteUserRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteUserRequestBody {
    pub method: DeleteUserMethod,
}


// ApiResponse_GetFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetFilesResponseBody {
    pub data: GetFilesResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_ListUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListUserGroupsResponseBody {
    pub data: ListUserGroupsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListAccessPoliciesRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAccessPoliciesRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListAccessPoliciesSortBy>,
    pub sort_order: Option<SortDirection>,
}


// ListAppsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAppsRequestBody {
    
}


// ListFilesRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesRequestBody {
    pub file_group_id: Uuid,
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort: Option<ListFilesSorting>,
}


// ListJobsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListJobsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListJobsSortBy>,
    pub sort_order: Option<SortDirection>,
}


// ListJobsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListJobsResponseBody {
    pub jobs: Vec<FilezJob>,
}


// JobStatusDetailsFailed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsFailed {
    pub error: Option<String>,
    pub message: String,
}


// SortDirection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    Ascending,
    Descending
}


// CreateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJobResponseBody {
    pub created_job: FilezJob,
}


// ApiResponse_UpdateJobStatusResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateJobStatusResponseBody {
    pub data: UpdateJobStatusResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListAccessPoliciesSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListAccessPoliciesSortBy {
    CreatedTime,
    ModifiedTime,
    Name
}


// ListFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesResponseBody {
    pub files: Vec<FilezFile>,
    pub total_count: u64,
}


// StorageQuota
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageQuota {
    pub created_time: NaiveDateTime,
    pub id: Uuid,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: Uuid,
    pub quota_bytes: i64,
    pub storage_location_id: Uuid,
    pub subject_id: Uuid,
    pub subject_type: AccessPolicySubjectType,
}


// UpdateJobStatusResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobStatusResponseBody {
    pub job: FilezJob,
}


// CreateUserResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserResponseBody {
    pub id: Uuid,
}


// CreateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileResponseBody {
    pub created_file: FilezFile,
}


// JobExecutionInformation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobExecutionInformation {
    pub job_type: JobType,
}


// ListStorageQuotasResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageQuotasResponseBody {
    pub storage_quotas: Vec<StorageQuota>,
}


// ListUserGroupsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListUserGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime
}


// GetStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaRequestBody {
    pub storage_location_id: Uuid,
    pub subject_id: Uuid,
    pub subject_type: AccessPolicySubjectType,
}


// UpdateUserGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupRequestBody {
    pub name: String,
    pub user_group_id: Uuid,
}


// UpdateUserGroupMembersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupMembersRequestBody {
    pub user_group_id: Uuid,
    pub users_to_add: Vec<Uuid>,
    pub users_to_remove: Vec<Uuid>,
}


// FileVersionSizeExceededErrorBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersionSizeExceededErrorBody {
    pub allowed: u64,
    pub received: u64,
}


// UserMeta
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMeta {
    pub user: FilezUser,
}


// GetJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetJobResponseBody {
    pub job: FilezJob,
}


// FilezUser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilezUser {
    pub created_by: Option<String>,
    pub created_time: NaiveDateTime,
    pub deleted: bool,
    pub display_name: String,
    pub external_user_id: Option<String>,
    pub id: Uuid,
    pub modified_time: NaiveDateTime,
    pub pre_identifier_email: Option<String>,
    pub profile_picture: Option<String>,
    pub user_type: FilezUserType,
}


// AppType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppType {
    frontend,
    backend
}


// ListFilesSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFilesSortBy {
    Name,
    CreatedTime,
    ModifiedTime
}


// UpdateJobStatusRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobStatusRequestBody {
    pub new_status: JobStatus,
    pub new_status_details: Option<JobStatusDetails>,
}


// PickupJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickupJobRequestBody {
    
}


// UpdateTagsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTagsRequestBody {
    pub resource_ids: Vec<Uuid>,
    pub resource_type: TagResourceType,
    pub update_tags: UpdateTagsMethod,
}


// JobStatusDetailsCancelled
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCancelled {
    pub message: String,
    pub reason: Option<String>,
}


// CreateFileGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileGroupRequestBody {
    pub dynamic_group_rule: Option<DynamicGroupRule>,
    pub group_type: FileGroupType,
    pub name: String,
}


// GetTagsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetTagsRequestBody {
    pub resource_ids: Vec<Uuid>,
    pub resource_type: TagResourceType,
}


// HealthStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub response: String,
}


// ListUsersSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListUsersSortBy {
    CreatedTime,
    ModifiedTime,
    Name
}


// PickupJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickupJobResponseBody {
    pub job: Option<FilezJob>,
}


// ListStorageLocationsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageLocationsResponseBody {
    pub storage_locations: Vec<StorageLocationListItem>,
}


// ApiResponse_ListUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListUsersResponseBody {
    pub data: ListUsersResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListStorageQuotasRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageQuotasRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListStorageQuotasSortBy>,
    pub sort_order: Option<SortDirection>,
}


// GetTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetTagsResponseBody {
    pub resource_tags: HashMap<Uuid, HashMap<String, String>>,
}


// ListFilesSortOrder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesSortOrder {
    pub sort_by: ListFilesSortBy,
    pub sort_order: Option<SortDirection>,
}


// CheckResourceAccessRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResourceAccessRequestBody {
    pub action: AccessPolicyAction,
    pub requesting_app_origin: Option<String>,
    pub resource_ids: Vec<Uuid>,
    pub resource_type: AccessPolicyResourceType,
}


// JobType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobType {
    CreatePreview(JobTypeCreatePreview)
}


// ApiResponse_AccessPolicy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseAccessPolicy {
    pub data: AccessPolicy,
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


// FileVersion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersion {
    pub app_id: Uuid,
    pub app_path: String,
    pub content_expected_sha256_digest: Option<String>,
    pub content_valid: bool,
    pub created_time: NaiveDateTime,
    pub file_id: Uuid,
    pub id: Uuid,
    pub metadata: FileVersionMetadata,
    pub mime_type: String,
    pub modified_time: NaiveDateTime,
    pub size: i64,
    pub storage_location_id: Uuid,
    pub storage_quota_id: Uuid,
    pub version: i32,
}


// FilezUserType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilezUserType {
    SuperAdmin,
    Regular,
    KeyAccess
}


// GetUsersResBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUsersResBody {
    pub users_meta: HashMap<Uuid, UserMeta>,
}


// ApiResponse_GetTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetTagsResponseBody {
    pub data: GetTagsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// DeleteFileRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteFileRequestBody {
    pub file_id: Uuid,
}


// FilezJob
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilezJob {
    pub app_id: Uuid,
    pub app_instance_last_seen_time: Option<String>,
    pub assigned_app_runtime_instance_id: Option<String>,
    pub created_time: NaiveDateTime,
    pub deadline_time: Option<String>,
    pub end_time: Option<String>,
    pub execution_information: JobExecutionInformation,
    pub id: Uuid,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: Uuid,
    pub persistence: JobPersistenceType,
    pub start_time: Option<String>,
    pub status: JobStatus,
    pub status_details: Option<JobStatusDetails>,
}


// UpdateFileVersionsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionsRequestBody {
    pub versions: Vec<UpdateFileVersion>,
}


// EmptyApiResponse
pub type EmptyApiResponse=serde_json::Value;


// ApiResponse_ListJobsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListJobsResponseBody {
    pub data: ListJobsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
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


// UpdateJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobRequestBody {
    pub deadline_time: Option<String>,
    pub execution_information: Option<JobExecutionInformation>,
    pub job_id: Uuid,
    pub name: Option<String>,
    pub persistence: Option<JobPersistenceType>,
    pub status: Option<JobStatus>,
    pub status_details: Option<JobStatusDetails>,
}


// CreateUserRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserRequestBody {
    pub email: String,
}


// ApiResponse_CreateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateStorageQuotaResponseBody {
    pub data: CreateStorageQuotaResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// DeleteStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteStorageQuotaRequestBody {
    pub storage_location_id: Uuid,
    pub subject_id: Uuid,
    pub subject_type: AccessPolicySubjectType,
}


// UpdateFileVersion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersion {
    pub identifier: FileVersionIdentifier,
    pub new_content_expected_sha256_digest: Option<String>,
    pub new_metadata: Option<FileVersionMetadata>,
}


// ApiResponse_ListFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListFileGroupsResponseBody {
    pub data: ListFileGroupsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListJobsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListJobsSortBy {
    Name,
    CreatedTime,
    ModifiedTime
}


// GetFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileVersionsResponseBody {
    pub versions: Vec<FileVersion>,
}


// ListUsersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUsersRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<SortDirection>,
    pub user_group_id: Uuid,
}


// ApiResponse_ListStorageLocationsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListStorageLocationsResponseBody {
    pub data: ListStorageLocationsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
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


// ListFileGroupsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFileGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime
}


// ApiResponse_PickupJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponsePickupJobResponseBody {
    pub data: PickupJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// CreateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStorageQuotaResponseBody {
    pub storage_quota: StorageQuota,
}


// AuthReason
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthReason {
    SuperAdmin,
    Owned,
    AllowedByPubliclyAccessible{
        policy_id: Uuid,
    },
    AllowedByServerAccessible{
        policy_id: Uuid,
    },
    AllowedByDirectUserPolicy{
        policy_id: Uuid,
    },
    AllowedByDirectGroupPolicy{
        policy_id: Uuid,
    via_user_group_id: Uuid,
    },
    AllowedByResourceGroupUserPolicy{
        on_resource_group_id: Uuid,
    policy_id: Uuid,
    },
    AllowedByResourceGroupUserGroupPolicy{
        on_resource_group_id: Uuid,
    policy_id: Uuid,
    via_user_group_id: Uuid,
    },
    DeniedByPubliclyAccessible{
        policy_id: Uuid,
    },
    DeniedByServerAccessible{
        policy_id: Uuid,
    },
    DeniedByDirectUserPolicy{
        policy_id: Uuid,
    },
    DeniedByDirectGroupPolicy{
        policy_id: Uuid,
    via_user_group_id: Uuid,
    },
    DeniedByResourceGroupUserPolicy{
        on_resource_group_id: Uuid,
    policy_id: Uuid,
    },
    DeniedByResourceGroupUserGroupPolicy{
        on_resource_group_id: Uuid,
    policy_id: Uuid,
    via_user_group_id: Uuid,
    },
    NoMatchingAllowPolicy,
    ResourceNotFound
}


// ApiResponse_DeleteFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseDeleteFileResponseBody {
    pub data: DeleteFileResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListFilesSorting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFilesSorting {
    StoredSortOrder(ListFilesStoredSortOrder),
    SortOrder(ListFilesSortOrder)
}


// JobStatusDetailsCreated
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCreated {
    pub message: String,
}


// DeleteFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteFileVersionsResponseBody {
    pub versions: Vec<FileVersionIdentifier>,
}


// ListStorageLocationsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageLocationsRequestBody {
    pub sort_by: Option<ListStorageLocationsSortBy>,
    pub sort_order: Option<SortDirection>,
}


// DynamicGroupRule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicGroupRule {
    
}


// GetFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFilesResponseBody {
    pub files: HashMap<Uuid, FilezFile>,
}


// FileMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub default_preview_app_id: Option<String>,
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


// ApiResponse_UserGroup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUserGroup {
    pub data: UserGroup,
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
    App
}


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
}


// GetJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetJobRequestBody {
    pub job_id: Uuid,
}


// ListUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUserGroupsResponseBody {
    pub user_groups: Vec<UserGroup>,
}


// UpdateStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorageQuotaRequestBody {
    pub quota_bytes: u64,
    pub storage_location_id: Uuid,
    pub subject_id: Uuid,
    pub subject_type: AccessPolicySubjectType,
}


// UpdateFileGroupMembersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupMembersRequestBody {
    pub file_group_id: Uuid,
    pub files_to_add: Vec<Uuid>,
    pub files_to_remove: Vec<Uuid>,
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


// CreateFileVersionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileVersionResponseBody {
    pub version: FileVersion,
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


// FileGroup
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileGroup {
    pub created_time: NaiveDateTime,
    pub dynamic_group_rule: Option<DynamicGroupRule>,
    pub group_type: FileGroupType,
    pub id: Uuid,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: Uuid,
}


// ApiResponse_StorageQuota
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseStorageQuota {
    pub data: StorageQuota,
    pub message: String,
    pub status: ApiResponseStatus,
}


// FileVersionMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersionMetadata {
    
}


// AccessPolicy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessPolicy {
    pub actions: Vec<AccessPolicyAction>,
    pub context_app_ids: Vec<Uuid>,
    pub created_time: NaiveDateTime,
    pub effect: AccessPolicyEffect,
    pub id: Uuid,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: Uuid,
    pub resource_id: Option<String>,
    pub resource_type: AccessPolicyResourceType,
    pub subject_id: Uuid,
    pub subject_type: AccessPolicySubjectType,
}


// CheckResourceAccessResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResourceAccessResponseBody {
    pub auth_evaluations: Vec<AuthEvaluation>,
}


// DeleteUserMethod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeleteUserMethod {
    ById(Uuid),
    ByExternalId(String),
    ByEmail(String)
}


// MowsApp
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MowsApp {
    pub app_type: AppType,
    pub created_time: NaiveDateTime,
    pub description: Option<String>,
    pub id: Uuid,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub origins: Vec<String>,
    pub trusted: bool,
}


// ApiResponse_DeleteUserResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseDeleteUserResponseBody {
    pub data: DeleteUserResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListAccessPoliciesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAccessPoliciesResponseBody {
    pub access_policies: Vec<AccessPolicy>,
}


// DeleteFileVersionsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteFileVersionsRequestBody {
    pub versions: Vec<FileVersionIdentifier>,
}


// ApiResponse_UpdateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateFileResponseBody {
    pub data: UpdateFileResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_HealthResBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseHealthResBody {
    pub data: HealthResBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// AccessPolicyEffect
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicyEffect {
    Deny,
    Allow
}


// ApiResponse_CreateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateFileResponseBody {
    pub data: CreateFileResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// CreateJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJobRequestBody {
    pub app_id: Uuid,
    pub deadline_time: Option<String>,
    pub execution_details: JobExecutionInformation,
    pub name: String,
    pub persistence: JobPersistenceType,
}


// UpdateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileResponseBody {
    pub file: FilezFile,
}


// ApiResponse_DeleteFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseDeleteFileVersionsResponseBody {
    pub data: DeleteFileVersionsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ApiResponse_FileVersionSizeExceededErrorBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseFileVersionSizeExceededErrorBody {
    pub data: FileVersionSizeExceededErrorBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// CreateStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStorageQuotaRequestBody {
    pub name: String,
    pub quota_bytes: u64,
    pub storage_location_id: Uuid,
    pub subject_id: Uuid,
    pub subject_type: AccessPolicySubjectType,
}


// GetAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAppsResponseBody {
    pub apps: HashMap<Uuid, MowsApp>,
}


// ListStorageLocationsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListStorageLocationsSortBy {
    CreatedTime,
    ModifiedTime,
    Name
}


// ApiResponse_String
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseString {
    pub data: String,
    pub message: String,
    pub status: ApiResponseStatus,
}


// ListedFilezUser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListedFilezUser {
    pub created_time: NaiveDateTime,
    pub display_name: String,
    pub id: Uuid,
}


// DeleteUserResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteUserResponseBody {
    pub user_id: Uuid,
}


// UpdateAccessPolicyRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAccessPolicyRequestBody {
    pub access_policy_id: Uuid,
    pub actions: Vec<AccessPolicyAction>,
    pub context_app_ids: Vec<Uuid>,
    pub effect: AccessPolicyEffect,
    pub name: String,
    pub resource_id: Option<String>,
    pub resource_type: AccessPolicyResourceType,
    pub subject_id: Uuid,
    pub subject_type: AccessPolicySubjectType,
}


// GetOwnUserBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetOwnUserBody {
    pub user: FilezUser,
}


// UpdateFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionsResponseBody {
    pub versions: Vec<FileVersion>,
}


// ApiResponse_GetOwnUserBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetOwnUserBody {
    pub data: GetOwnUserBody,
    pub message: String,
    pub status: ApiResponseStatus,
}


// GetUsersReqBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUsersReqBody {
    pub user_ids: Vec<Uuid>,
}


// ApiResponse_ListAccessPoliciesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListAccessPoliciesResponseBody {
    pub data: ListAccessPoliciesResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

