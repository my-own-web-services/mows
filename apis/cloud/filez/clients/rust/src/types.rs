// This file is auto-generated from OpenAPI specification
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

// AccessPolicy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessPolicy {
    pub actions: Vec<AccessPolicyAction>,
    /// The IDs of the application this policy is associated with
    pub context_app_ids: Vec<MowsAppId>,
    pub created_time: NaiveDateTime,
    pub effect: AccessPolicyEffect,
    pub id: AccessPolicyId,
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: FilezUserId,
    /// The ID of the resource this policy applies to, if no resource ID is provided, the policy is a type level policy, allowing for example the creation of a resource of that type.
    pub resource_id: Option<Uuid>,
    pub resource_type: AccessPolicyResourceType,
    pub subject_id: AccessPolicySubjectId,
    pub subject_type: AccessPolicySubjectType,
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
    FilezAppsList,
}

// AccessPolicyEffect
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicyEffect {
    Deny,
    Allow,
}

// AccessPolicyId
pub type AccessPolicyId = Uuid;

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

// AccessPolicySubjectId
pub type AccessPolicySubjectId = Uuid;

// AccessPolicySubjectType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPolicySubjectType {
    User,
    UserGroup,
    ServerMember,
    Public,
}

// ApiResponseStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApiResponseStatus {
    Success,
    Error(String),
}

// ApiResponse_CheckResourceAccessResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCheckResourceAccessResponseBody {
    pub data: CheckResourceAccessResponseBody,
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

// ApiResponse_CreateFileGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateFileGroupResponseBody {
    pub data: CreateFileGroupResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_CreateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateFileResponseBody {
    pub data: CreateFileResponseBody,
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

// ApiResponse_CreateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateJobResponseBody {
    pub data: CreateJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_CreateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateStorageQuotaResponseBody {
    pub data: CreateStorageQuotaResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_CreateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseCreateUserGroupResponseBody {
    pub data: CreateUserGroupResponseBody,
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

// ApiResponse_EmptyApiResponse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseEmptyApiResponse {
    pub data: Option<()>,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_EndSessionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseEndSessionResponseBody {
    pub data: EndSessionResponseBody,
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

// ApiResponse_GetAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetAccessPolicyResponseBody {
    pub data: GetAccessPolicyResponseBody,
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

// ApiResponse_GetFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetFileGroupsResponseBody {
    pub data: GetFileGroupsResponseBody,
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

// ApiResponse_GetFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetFilesResponseBody {
    pub data: GetFilesResponseBody,
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

// ApiResponse_GetOwnUserBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetOwnUserBody {
    pub data: GetOwnUserBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_GetSessionTimeoutResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetSessionTimeoutResponseBody {
    pub data: GetSessionTimeoutResponseBody,
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

// ApiResponse_GetStorageQuotaUsageResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetStorageQuotaUsageResponseBody {
    pub data: GetStorageQuotaUsageResponseBody,
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

// ApiResponse_GetUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseGetUsersResponseBody {
    pub data: GetUsersResponseBody,
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

// ApiResponse_ListAccessPoliciesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListAccessPoliciesResponseBody {
    pub data: ListAccessPoliciesResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_ListAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListAppsResponseBody {
    pub data: ListAppsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_ListFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListFileGroupsResponseBody {
    pub data: ListFileGroupsResponseBody,
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

// ApiResponse_ListJobsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListJobsResponseBody {
    pub data: ListJobsResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_ListStorageLocationsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListStorageLocationsResponseBody {
    pub data: ListStorageLocationsResponseBody,
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

// ApiResponse_ListTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListTagsResponseBody {
    pub data: ListTagsResponseBody,
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

// ApiResponse_ListUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseListUsersResponseBody {
    pub data: ListUsersResponseBody,
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

// ApiResponse_RefreshSessionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseRefreshSessionResponseBody {
    pub data: RefreshSessionResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_StartSessionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseStartSessionResponseBody {
    pub data: StartSessionResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_String
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseString {
    pub data: String,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_UpdateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateAccessPolicyResponseBody {
    pub data: UpdateAccessPolicyResponseBody,
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

// ApiResponse_UpdateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateFileResponseBody {
    pub data: UpdateFileResponseBody,
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

// ApiResponse_UpdateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateJobResponseBody {
    pub data: UpdateJobResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_UpdateJobStatusResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateJobStatusResponseBody {
    pub data: UpdateJobStatusResponseBody,
    pub message: String,
    pub status: ApiResponseStatus,
}

// ApiResponse_UpdateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponseUpdateStorageQuotaResponseBody {
    pub data: UpdateStorageQuotaResponseBody,
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

// AppType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppType {
    #[serde(rename = "frontend")]
    Frontend,
    #[serde(rename = "backend")]
    Backend,
}

// AuthEvaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthEvaluation {
    pub is_allowed: bool,
    pub reason: AuthReason,
    pub resource_id: Option<Uuid>,
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

// CheckResourceAccessRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResourceAccessRequestBody {
    pub access_policy_action: AccessPolicyAction,
    pub access_policy_resource_type: AccessPolicyResourceType,
    pub requesting_app_origin: Option<String>,
    pub resource_ids: Option<Vec<Uuid>>,
}

// CheckResourceAccessResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResourceAccessResponseBody {
    pub auth_evaluations: Vec<AuthEvaluation>,
}

// ControllerHealthDetails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControllerHealthDetails {
    pub crd_error: Option<String>,
    pub crd_installed: bool,
    pub kubernetes_error: Option<String>,
    pub kubernetes_reachable: bool,
    pub last_reconcile_event: Option<NaiveDateTime>,
    pub reconcile_loop_running: bool,
    pub reconcile_stale: bool,
}

// ControllerHealthStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControllerHealthStatus {
    pub details: Option<ControllerHealthDetails>,
    pub healthy: bool,
    pub response: String,
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
    pub resource_id: Option<Uuid>,
}

// CreateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAccessPolicyResponseBody {
    pub created_access_policy: AccessPolicy,
}

// CreateFileGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileGroupRequestBody {
    pub dynamic_group_rule: Option<DynamicGroupRule>,
    pub file_group_name: String,
    pub file_group_type: FileGroupType,
}

// CreateFileGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileGroupResponseBody {
    pub created_file_group: FileGroup,
}

// CreateFileRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileRequestBody {
    pub file_name: String,
    pub mime_type: Option<String>,
    pub time_created: Option<NaiveDateTime>,
    pub time_modified: Option<NaiveDateTime>,
}

// CreateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileResponseBody {
    pub created_file: FilezFile,
}

// CreateFileVersionRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileVersionRequestBody {
    pub app_path: Option<String>,
    /// Optional SHA256 digest of the file content as a lowercase hexadecimal string.
    /// Once the content is fully uploaded it automatically gets validated against this digest.
    /// After successful validation, the versions content_valid field is set to true.
    pub content_expected_sha256_digest: Option<String>,
    pub file_id: FilezFileId,
    pub file_version_metadata: FileVersionMetadata,
    /// The MIME type of the file version.
    pub file_version_mime_type: String,
    pub file_version_number: Option<u32>,
    /// The size of the file version in bytes.
    pub file_version_size: u64,
    pub storage_quota_id: StorageQuotaId,
}

// CreateFileVersionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileVersionResponseBody {
    pub created_file_version: FileVersion,
}

// CreateJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJobRequestBody {
    pub job_deadline_time: Option<NaiveDateTime>,
    pub job_execution_details: JobExecutionInformation,
    pub job_handling_app_id: MowsAppId,
    pub job_name: String,
    pub job_persistence: JobPersistenceType,
    pub job_priority: i32,
}

// CreateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJobResponseBody {
    pub created_job: FilezJob,
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

// CreateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserGroupResponseBody {
    pub created_user_group: UserGroup,
}

// CreateUserRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserRequestBody {
    pub email: String,
}

// CreateUserResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserResponseBody {
    pub created_user: FilezUser,
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

// DatabaseHealthStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseHealthStatus {
    pub details: Option<DatabaseHealthDetails>,
    pub healthy: bool,
    pub message: String,
}

// DeleteUserMethod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeleteUserMethod {
    ById(FilezUserId),
    ByExternalId(String),
    ByEmail(String),
}

// DeleteUserRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteUserRequestBody {
    pub delete_user_method: DeleteUserMethod,
}

// DevResetDatabaseRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevResetDatabaseRequestBody {}

// DynamicGroupRule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicGroupRule {}

// EmptyApiResponse
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmptyApiResponse {}

// EndSessionRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndSessionRequestBody {}

// EndSessionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndSessionResponseBody {}

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

// FileGroupId
pub type FileGroupId = Uuid;

// FileGroupType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileGroupType {
    Manual,
    Dynamic,
}

// FileMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub default_preview_app_id: Option<MowsAppId>,
    /// Extracted data from the file, such as text content, metadata, etc.
    pub extracted_data: Value,
    /// Place for apps to store custom data related to the file.
    /// every app is identified by its id, and can only access its own data.
    pub private_app_data: Value,
    /// Apps can provide and request shared app data from other apps on creation
    pub shared_app_data: Value,
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

// FileVersionId
pub type FileVersionId = Uuid;

// FileVersionMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersionMetadata {}

// FileVersionSizeExceededErrorBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileVersionSizeExceededErrorBody {
    pub allowed: u64,
    pub received: u64,
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

// FilezFileId
pub type FilezFileId = Uuid;

// FilezJob
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilezJob {
    pub app_id: MowsAppId,
    /// The last time the app instance has been seen by the server
    /// This is used to determine if the app instance is still alive and can handle the job
    pub app_instance_last_seen_time: Option<NaiveDateTime>,
    /// After the job is picked up by the app, this field will be set to the app instance id, created from the kubernetes pod UUID and a random string that the app generates on startup
    pub assigned_app_runtime_instance_id: Option<String>,
    /// When the job was created in the database
    pub created_time: NaiveDateTime,
    /// After the deadline the job will be marked as finished and failed if not completed
    pub deadline_time: Option<NaiveDateTime>,
    /// When the job was finished, either successfully or failed
    pub end_time: Option<NaiveDateTime>,
    pub execution_information: JobExecutionInformation,
    pub id: FilezJobId,
    /// When the job was last modified in the database
    pub modified_time: NaiveDateTime,
    pub name: String,
    pub owner_id: FilezUserId,
    pub persistence: JobPersistenceType,
    /// Priority of the job (1-10), higher values are picked up first
    pub priority: i32,
    /// When the job was started, either automatically or manually
    pub start_time: Option<NaiveDateTime>,
    pub status: JobStatus,
    pub status_details: Option<JobStatusDetails>,
}

// FilezJobId
pub type FilezJobId = Uuid;

// FilezUser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilezUser {
    pub created_by: Option<FilezUserId>,
    pub created_time: NaiveDateTime,
    pub deleted: bool,
    /// The display name of the user, updated from the external identity provider on each login
    pub display_name: String,
    /// The external user ID, e.g. from ZITADEL or other identity providers
    pub external_user_id: Option<String>,
    pub id: FilezUserId,
    pub modified_time: NaiveDateTime,
    /// Used to create a user before the external user ID is known, when the user then logs in with a verified email address the email is switched to the external user ID
    pub pre_identifier_email: Option<String>,
    pub profile_picture: Option<FilezFileId>,
    pub user_type: FilezUserType,
}

// FilezUserId
pub type FilezUserId = Uuid;

// FilezUserType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilezUserType {
    SuperAdmin,
    Regular,
    KeyAccess,
}

// GetAccessPolicyRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAccessPolicyRequestBody {
    pub access_policy_ids: Vec<AccessPolicyId>,
}

// GetAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAccessPolicyResponseBody {
    pub access_policies: Vec<AccessPolicy>,
}

// GetAppsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAppsRequestBody {
    pub app_ids: Vec<MowsAppId>,
}

// GetAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetAppsResponseBody {
    pub apps: HashMap<Uuid, MowsApp>,
}

// GetFileGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileGroupsRequestBody {
    pub file_group_ids: Vec<FileGroupId>,
}

// GetFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileGroupsResponseBody {
    pub file_groups: Vec<FileGroup>,
}

// GetFileVersionsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileVersionsRequestBody {
    pub file_version_ids: Vec<FileVersionId>,
}

// GetFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFileVersionsResponseBody {
    pub file_versions: Vec<FileVersion>,
}

// GetFilesRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFilesRequestBody {
    pub file_ids: Vec<FilezFileId>,
}

// GetFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetFilesResponseBody {
    pub files: Vec<FilezFile>,
}

// GetJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetJobRequestBody {
    pub job_id: FilezJobId,
}

// GetJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetJobResponseBody {
    pub job: FilezJob,
}

// GetOwnUserBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetOwnUserBody {
    pub user: FilezUser,
}

// GetSessionTimeoutResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetSessionTimeoutResponseBody {
    pub inactivity_timeout_seconds: i64,
}

// GetStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaRequestBody {
    pub storage_quota_ids: Vec<StorageQuotaId>,
}

// GetStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaResponseBody {
    pub storage_quotas: Vec<StorageQuota>,
}

// GetStorageQuotaUsageRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaUsageRequestBody {
    pub storage_quota_id: StorageQuotaId,
}

// GetStorageQuotaUsageResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStorageQuotaUsageResponseBody {
    pub storage_quota: StorageQuota,
    pub used_bytes: u64,
}

// GetTagsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetTagsRequestBody {
    pub resource_ids: Vec<Uuid>,
    pub tag_resource_type: TagResourceType,
}

// GetTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetTagsResponseBody {
    pub resource_tags: HashMap<Uuid, HashMap<String, String>>,
}

// GetUserGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUserGroupsRequestBody {
    /// The IDs of the user groups to retrieve
    pub user_group_ids: Vec<UserGroupId>,
}

// GetUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUserGroupsResponseBody {
    /// The retrieved user groups
    pub user_groups: Vec<UserGroup>,
}

// GetUsersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUsersRequestBody {
    pub user_ids: Vec<FilezUserId>,
}

// GetUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUsersResponseBody {
    pub users_meta: HashMap<Uuid, UserMeta>,
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

// HealthStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub message: String,
}

// JobExecutionInformation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobExecutionInformation {
    pub job_type: JobType,
}

// JobPersistenceType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobPersistenceType {
    Temporary,
    Persistent,
}

// JobStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobStatus {
    Created,
    InProgress,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

// JobStatusDetails
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobStatusDetails {
    Created(JobStatusDetailsCreated),
    InProgress(JobStatusDetailsInProgress),
    Completed(JobStatusDetailsCompleted),
    Failed(JobStatusDetailsFailed),
    Cancelled(JobStatusDetailsCancelled),
}

// JobStatusDetailsCancelled
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCancelled {
    pub message: String,
    pub reason: Option<String>,
}

// JobStatusDetailsCompleted
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCompleted {
    pub message: String,
}

// JobStatusDetailsCreated
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsCreated {
    pub message: String,
}

// JobStatusDetailsFailed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsFailed {
    pub error: Option<String>,
    pub message: String,
}

// JobStatusDetailsInProgress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatusDetailsInProgress {
    pub message: String,
    pub steps: Option<Vec<ProgressStep>>,
}

// JobType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobType {
    CreatePreview(JobTypeCreatePreview),
    ExtractMetadata(JobTypeExtractMetadata),
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

// JobTypeExtractMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobTypeExtractMetadata {
    pub extract_metadata_config: Value,
    pub file_id: FilezFileId,
    pub file_version_number: u32,
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

// ListAccessPoliciesSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListAccessPoliciesSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
}

// ListAppsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAppsRequestBody {}

// ListAppsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListAppsResponseBody {
    pub apps: Vec<MowsApp>,
}

// ListFileGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFileGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListFileGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}

// ListFileGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFileGroupsResponseBody {
    pub file_groups: Vec<FileGroup>,
    pub total_count: u64,
}

// ListFileGroupsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFileGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}

// ListFilesRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesRequestBody {
    pub file_group_id: FileGroupId,
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort: Option<ListFilesSorting>,
}

// ListFilesResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesResponseBody {
    pub files: Vec<FilezFile>,
    pub total_count: u64,
}

// ListFilesSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFilesSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
}

// ListFilesSortOrder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesSortOrder {
    pub sort_by: ListFilesSortBy,
    pub sort_order: Option<SortDirection>,
}

// ListFilesSorting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListFilesSorting {
    StoredSortOrder(ListFilesStoredSortOrder),
    SortOrder(ListFilesSortOrder),
}

// ListFilesStoredSortOrder
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesStoredSortOrder {
    pub direction: Option<SortDirection>,
    pub stored_sort_order_id: Uuid,
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
    pub total_count: u64,
}

// ListJobsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListJobsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
    Status,
    AppId,
}

// ListStorageLocationsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageLocationsRequestBody {
    pub sort_by: Option<ListStorageLocationsSortBy>,
    pub sort_order: Option<SortDirection>,
}

// ListStorageLocationsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageLocationsResponseBody {
    pub storage_locations: Vec<StorageLocationListItem>,
}

// ListStorageLocationsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListStorageLocationsSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
}

// ListStorageQuotasRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageQuotasRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListStorageQuotasSortBy>,
    pub sort_order: Option<SortDirection>,
}

// ListStorageQuotasResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListStorageQuotasResponseBody {
    pub storage_quotas: Vec<StorageQuota>,
    pub total_count: u64,
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

// ListTagResult
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTagResult {
    pub resource_type: TagResourceType,
    pub tag_key: String,
    pub tag_value: String,
    pub usage_count: u64,
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

// ListTagsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTagsResponseBody {
    pub tags: Vec<ListTagResult>,
    pub total_count: u64,
}

// ListTagsSearch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTagsSearch {
    pub plain_string: Option<String>,
    pub search_context: Option<ListTagsSearchContext>,
    pub tag_key: Option<String>,
    pub tag_value: Option<String>,
}

// ListTagsSearchContext
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTagsSearchContext {
    /// The resource IDs that are currently selected in the UI, this could be used in the future to prioritize tags that are already in use by similar resources
    pub resource_ids: Vec<Uuid>,
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

// ListUserGroupsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUserGroupsRequestBody {
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListUserGroupsSortBy>,
    pub sort_order: Option<SortDirection>,
}

// ListUserGroupsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUserGroupsResponseBody {
    pub total_count: u64,
    pub user_groups: Vec<UserGroup>,
}

// ListUserGroupsSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListUserGroupsSortBy {
    Name,
    CreatedTime,
    ModifiedTime,
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

// ListUsersResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListUsersResponseBody {
    pub total_count: u64,
    pub users: Vec<FilezUser>,
}

// ListUsersSortBy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ListUsersSortBy {
    CreatedTime,
    ModifiedTime,
    Name,
}

// ListedFilezUser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListedFilezUser {
    pub created_time: NaiveDateTime,
    pub display_name: String,
    pub id: FilezUserId,
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
    /// Name and Namespace of the app in Kubernetes
    /// Renaming an app in Kubernetes will not change the name in the database but create a new app with the new name
    /// Generally the name should not be changed, if it is it can be manually adjusted in the database
    pub name: String,
    /// Origins are used to identify the app in the browser, all origins must be unique across all apps
    /// If an app has no origins, it is considered a backend app
    pub origins: Option<Vec<String>>,
    /// If a app is marked as trusted, it can access all resources without any restrictions
    pub trusted: bool,
}

// MowsAppId
pub type MowsAppId = Uuid;

// PickupJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickupJobRequestBody {}

// PickupJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickupJobResponseBody {
    pub job: Option<FilezJob>,
}

// PoolStatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStatus {
    pub available: i64,
    pub max_size: i64,
    pub size: i64,
}

// ProgressStep
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressStep {
    pub completed: bool,
    pub description: Option<String>,
    pub name: String,
}

// RefreshSessionRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshSessionRequestBody {}

// RefreshSessionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshSessionResponseBody {
    pub inactivity_timeout_seconds: i64,
}

// SortDirection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    Ascending,
    Descending,
    Neutral,
}

// StartSessionRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartSessionRequestBody {}

// StartSessionResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartSessionResponseBody {
    pub inactivity_timeout_seconds: i64,
}

// StorageLocationId
pub type StorageLocationId = Uuid;

// StorageLocationListItem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageLocationListItem {
    pub created_time: NaiveDateTime,
    pub id: StorageLocationId,
    pub modified_time: NaiveDateTime,
    pub name: String,
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

// StorageQuotaId
pub type StorageQuotaId = Uuid;

// StorageQuotaSubjectId
pub type StorageQuotaSubjectId = Uuid;

// StorageQuotaSubjectType
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StorageQuotaSubjectType {
    User,
    UserGroup,
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
    pub new_resource_id: Option<Uuid>,
}

// UpdateAccessPolicyRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAccessPolicyRequestBody {
    pub access_policy_id: AccessPolicyId,
    pub changeset: UpdateAccessPolicyChangeset,
}

// UpdateAccessPolicyResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAccessPolicyResponseBody {
    pub updated_access_policy: AccessPolicy,
}

// UpdateFileChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileChangeset {
    pub new_file_metadata: Option<FileMetadata>,
    pub new_file_mime_type: Option<String>,
    pub new_file_name: Option<String>,
}

// UpdateFileGroupChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupChangeset {
    pub new_file_group_name: Option<String>,
}

// UpdateFileGroupMembersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupMembersRequestBody {
    pub file_group_id: FileGroupId,
    pub files_to_add: Option<Vec<FilezFileId>>,
    pub files_to_remove: Option<Vec<FilezFileId>>,
}

// UpdateFileGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupRequestBody {
    pub changeset: UpdateFileGroupChangeset,
    pub file_group_id: FileGroupId,
}

// UpdateFileGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileGroupResponseBody {
    pub updated_file_group: FileGroup,
}

// UpdateFileRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileRequestBody {
    pub changeset: UpdateFileChangeset,
    pub file_id: FilezFileId,
}

// UpdateFileResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileResponseBody {
    pub updated_file: FilezFile,
}

// UpdateFileVersionChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionChangeset {
    pub new_content_expected_sha256_digest: Option<String>,
    pub new_file_version_metadata: Option<FileVersionMetadata>,
    pub new_file_version_mime_type: Option<String>,
}

// UpdateFileVersionsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionsRequestBody {
    pub changeset: UpdateFileVersionChangeset,
    pub file_version_id: FileVersionId,
}

// UpdateFileVersionsResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileVersionsResponseBody {
    pub updated_file_version: FileVersion,
}

// UpdateJobChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobChangeset {
    pub new_job_deadline_time: Option<NaiveDateTime>,
    pub new_job_execution_information: Option<JobExecutionInformation>,
    pub new_job_name: Option<String>,
    pub new_job_persistence: Option<JobPersistenceType>,
    pub new_job_priority: Option<i32>,
}

// UpdateJobRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobRequestBody {
    pub changeset: UpdateJobChangeset,
    pub job_id: FilezJobId,
}

// UpdateJobResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobResponseBody {
    pub job: FilezJob,
}

// UpdateJobStatusRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobStatusRequestBody {
    pub new_job_status_details: Option<JobStatusDetails>,
    pub new_status: JobStatus,
}

// UpdateJobStatusResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateJobStatusResponseBody {
    pub updated_job: FilezJob,
}

// UpdateStorageQuotaChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorageQuotaChangeset {
    pub new_storage_quota_bytes: Option<i64>,
}

// UpdateStorageQuotaRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorageQuotaRequestBody {
    pub changeset: UpdateStorageQuotaChangeset,
    pub storage_quota_id: StorageQuotaId,
}

// UpdateStorageQuotaResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorageQuotaResponseBody {
    pub updated_storage_quota: StorageQuota,
}

// UpdateTagsMethod
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UpdateTagsMethod {
    Add(HashMap<String, String>),
    Remove(HashMap<String, String>),
    Set(HashMap<String, String>),
    Clear,
}

// UpdateTagsRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTagsRequestBody {
    pub resource_ids: Vec<Uuid>,
    pub tag_resource_type: TagResourceType,
    pub update_tags: UpdateTagsMethod,
}

// UpdateUserGroupChangeset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupChangeset {
    pub new_user_group_name: Option<String>,
}

// UpdateUserGroupMembersRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupMembersRequestBody {
    pub user_group_id: UserGroupId,
    pub users_to_add: Option<Vec<FilezUserId>>,
    pub users_to_remove: Option<Vec<FilezUserId>>,
}

// UpdateUserGroupRequestBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupRequestBody {
    pub changeset: UpdateUserGroupChangeset,
    pub user_group_id: UserGroupId,
}

// UpdateUserGroupResponseBody
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserGroupResponseBody {
    pub updated_user_group: UserGroup,
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

// UserGroupId
pub type UserGroupId = Uuid;

// UserMeta
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMeta {
    pub user: FilezUser,
}
