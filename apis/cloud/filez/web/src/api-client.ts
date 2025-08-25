/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export enum TagResourceType {
  File = "File",
  FileVersion = "FileVersion",
  FileGroup = "FileGroup",
  User = "User",
  UserGroup = "UserGroup",
  StorageLocation = "StorageLocation",
  AccessPolicy = "AccessPolicy",
  StorageQuota = "StorageQuota",
}

export enum StorageQuotaSubjectType {
  User = "User",
  UserGroup = "UserGroup",
}

export enum SortDirection {
  Ascending = "Ascending",
  Descending = "Descending",
}

export enum ListUsersSortBy {
  CreatedTime = "CreatedTime",
  ModifiedTime = "ModifiedTime",
  Name = "Name",
}

export enum ListUserGroupsSortBy {
  Name = "Name",
  CreatedTime = "CreatedTime",
  ModifiedTime = "ModifiedTime",
}

export enum ListStorageQuotasSortBy {
  CreatedTime = "CreatedTime",
  ModifiedTime = "ModifiedTime",
  SubjectType = "SubjectType",
  SubjectId = "SubjectId",
  StorageLocationId = "StorageLocationId",
}

export enum ListStorageLocationsSortBy {
  CreatedTime = "CreatedTime",
  ModifiedTime = "ModifiedTime",
  Name = "Name",
}

export enum ListJobsSortBy {
  Name = "Name",
  CreatedTime = "CreatedTime",
  ModifiedTime = "ModifiedTime",
}

export enum ListFilesSortBy {
  Name = "Name",
  CreatedTime = "CreatedTime",
  ModifiedTime = "ModifiedTime",
}

export enum ListFileGroupsSortBy {
  Name = "Name",
  CreatedTime = "CreatedTime",
  ModifiedTime = "ModifiedTime",
}

export enum ListAccessPoliciesSortBy {
  CreatedTime = "CreatedTime",
  ModifiedTime = "ModifiedTime",
  Name = "Name",
}

export enum JobStatus {
  Created = "Created",
  InProgress = "InProgress",
  Completed = "Completed",
  Failed = "Failed",
  Cancelled = "Cancelled",
}

export enum JobPersistenceType {
  Temporary = "Temporary",
  Persistent = "Persistent",
}

export enum FilezUserType {
  SuperAdmin = "SuperAdmin",
  Regular = "Regular",
  KeyAccess = "KeyAccess",
}

export enum FileGroupType {
  Manual = "Manual",
  Dynamic = "Dynamic",
}

export enum AppType {
  Frontend = "frontend",
  Backend = "backend",
}

export enum AccessPolicySubjectType {
  User = "User",
  UserGroup = "UserGroup",
  ServerMember = "ServerMember",
  Public = "Public",
}

export enum AccessPolicyResourceType {
  File = "File",
  FileGroup = "FileGroup",
  User = "User",
  UserGroup = "UserGroup",
  StorageLocation = "StorageLocation",
  AccessPolicy = "AccessPolicy",
  StorageQuota = "StorageQuota",
  FilezJob = "FilezJob",
  App = "App",
}

export enum AccessPolicyEffect {
  Deny = "Deny",
  Allow = "Allow",
}

export enum AccessPolicyAction {
  FilezFilesCreate = "FilezFilesCreate",
  FilezFilesDelete = "FilezFilesDelete",
  FilezFilesGet = "FilezFilesGet",
  FilezFilesUpdate = "FilezFilesUpdate",
  FilezFilesVersionsContentGet = "FilezFilesVersionsContentGet",
  FilezFilesVersionsContentTusHead = "FilezFilesVersionsContentTusHead",
  FilezFilesVersionsContentTusPatch = "FilezFilesVersionsContentTusPatch",
  FilezFilesVersionsDelete = "FilezFilesVersionsDelete",
  FilezFilesVersionsGet = "FilezFilesVersionsGet",
  FilezFilesVersionsUpdate = "FilezFilesVersionsUpdate",
  FilezFilesVersionsCreate = "FilezFilesVersionsCreate",
  UsersGet = "UsersGet",
  UsersList = "UsersList",
  UsersCreate = "UsersCreate",
  UsersUpdate = "UsersUpdate",
  UsersDelete = "UsersDelete",
  FileGroupsCreate = "FileGroupsCreate",
  FileGroupsGet = "FileGroupsGet",
  FileGroupsUpdate = "FileGroupsUpdate",
  FileGroupsDelete = "FileGroupsDelete",
  FileGroupsList = "FileGroupsList",
  FileGroupsListFiles = "FileGroupsListFiles",
  FileGroupsUpdateMembers = "FileGroupsUpdateMembers",
  UserGroupsCreate = "UserGroupsCreate",
  UserGroupsGet = "UserGroupsGet",
  UserGroupsUpdate = "UserGroupsUpdate",
  UserGroupsDelete = "UserGroupsDelete",
  UserGroupsList = "UserGroupsList",
  UserGroupsListUsers = "UserGroupsListUsers",
  UserGroupsUpdateMembers = "UserGroupsUpdateMembers",
  AccessPoliciesCreate = "AccessPoliciesCreate",
  AccessPoliciesGet = "AccessPoliciesGet",
  AccessPoliciesUpdate = "AccessPoliciesUpdate",
  AccessPoliciesDelete = "AccessPoliciesDelete",
  AccessPoliciesList = "AccessPoliciesList",
  StorageQuotasCreate = "StorageQuotasCreate",
  StorageQuotasGet = "StorageQuotasGet",
  StorageQuotasUpdate = "StorageQuotasUpdate",
  StorageQuotasDelete = "StorageQuotasDelete",
  StorageQuotasList = "StorageQuotasList",
  StorageLocationsGet = "StorageLocationsGet",
  StorageLocationsList = "StorageLocationsList",
  TagsUpdate = "TagsUpdate",
  TagsGet = "TagsGet",
  FilezJobsCreate = "FilezJobsCreate",
  FilezJobsGet = "FilezJobsGet",
  FilezJobsUpdate = "FilezJobsUpdate",
  FilezJobsDelete = "FilezJobsDelete",
  FilezJobsList = "FilezJobsList",
  FilezJobsPickup = "FilezJobsPickup",
  FilezAppsGet = "FilezAppsGet",
  FilezAppsList = "FilezAppsList",
}

export interface AccessPolicy {
  actions: AccessPolicyAction[];
  /** The IDs of the application this policy is associated with */
  context_app_ids: MowsAppId[];
  /** @format date-time */
  created_time: string;
  effect: AccessPolicyEffect;
  id: AccessPolicyId;
  /** @format date-time */
  modified_time: string;
  name: string;
  owner_id: FilezUserId;
  /**
   * The ID of the resource this policy applies to, if no resource ID is provided, the policy is a type level policy, allowing for example the creation of a resource of that type.
   * @format uuid
   */
  resource_id?: string | null;
  resource_type: AccessPolicyResourceType;
  subject_id: AccessPolicySubjectId;
  subject_type: AccessPolicySubjectType;
}

/** @format uuid */
export type AccessPolicyId = string;

/** @format uuid */
export type AccessPolicySubjectId = string;

export type ApiResponseStatus =
  | "Success"
  | {
      Error: string;
    };

export interface ApiResponseCheckResourceAccessResponseBody {
  data?: {
    auth_evaluations: AuthEvaluation[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateAccessPolicyResponseBody {
  data?: {
    created_access_policy: AccessPolicy;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateFileGroupResponseBody {
  data?: {
    created_file_group: FileGroup;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateFileResponseBody {
  data?: {
    created_file: FilezFile;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateFileVersionResponseBody {
  data?: {
    created_file_version: FileVersion;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateJobResponseBody {
  data?: {
    created_job: FilezJob;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateStorageQuotaResponseBody {
  data?: {
    created_storage_quota: StorageQuota;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateUserGroupResponseBody {
  data?: {
    created_user_group: UserGroup;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateUserResponseBody {
  data?: {
    created_user: FilezUser;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseEmptyApiResponse {
  data?: object;
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseFileVersionSizeExceededErrorBody {
  data?: {
    /**
     * @format int64
     * @min 0
     */
    allowed: number;
    /**
     * @format int64
     * @min 0
     */
    received: number;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetAccessPolicyResponseBody {
  data?: {
    access_policies: AccessPolicy[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetAppsResponseBody {
  data?: {
    apps: Record<string, MowsApp>;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetFileGroupsResponseBody {
  data?: {
    file_groups: FileGroup[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetFileVersionsResponseBody {
  data?: {
    file_versions: FileVersion[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetFilesResponseBody {
  data?: {
    files: FilezFile[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetJobResponseBody {
  data?: {
    job: FilezJob;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetOwnUserBody {
  data?: {
    user: FilezUser;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetStorageQuotaResponseBody {
  data?: {
    storage_quotas: StorageQuota[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetTagsResponseBody {
  data?: {
    resource_tags: Record<string, Record<string, string>>;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetUserGroupsResponseBody {
  data?: {
    /** The retrieved user groups */
    user_groups: UserGroup[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetUsersResBody {
  data?: {
    users_meta: Record<string, UserMeta>;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseHealthResBody {
  data?: {
    all_healthy: boolean;
    controller: HealthStatus;
    database: HealthStatus;
    storage_locations: Record<string, HealthStatus>;
    zitadel: HealthStatus;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseListAccessPoliciesResponseBody {
  data?: {
    access_policies: AccessPolicy[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseListAppsResponseBody {
  data?: {
    apps: MowsApp[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseListFileGroupsResponseBody {
  data?: {
    file_groups: FileGroup[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseListFilesResponseBody {
  data?: {
    files: FilezFile[];
    /**
     * @format int64
     * @min 0
     */
    total_count: number;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseListJobsResponseBody {
  data?: {
    jobs: FilezJob[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseListStorageLocationsResponseBody {
  data?: {
    storage_locations: StorageLocationListItem[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseListStorageQuotasResponseBody {
  data?: {
    storage_quotas: StorageQuota[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseListUserGroupsResponseBody {
  data?: {
    user_groups: UserGroup[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseListUsersResponseBody {
  data?: {
    /**
     * @format int64
     * @min 0
     */
    total_count: number;
    users: FilezUser[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponsePickupJobResponseBody {
  data?: {
    job?: null | FilezJob;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseString {
  data?: string;
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUpdateAccessPolicyResponseBody {
  data?: {
    updated_access_policy: AccessPolicy;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUpdateFileGroupResponseBody {
  data?: {
    updated_file_group: FileGroup;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUpdateFileResponseBody {
  data?: {
    updated_file: FilezFile;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUpdateFileVersionsResponseBody {
  data?: {
    updated_file_version: FileVersion;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUpdateJobResponseBody {
  data?: {
    job: FilezJob;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUpdateJobStatusResponseBody {
  data?: {
    updated_job: FilezJob;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUpdateStorageQuotaResponseBody {
  data?: {
    updated_storage_quota: StorageQuota;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUpdateUserGroupResponseBody {
  data?: {
    updated_user_group: UserGroup;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface AuthEvaluation {
  is_allowed: boolean;
  reason: AuthReason;
  /** @format uuid */
  resource_id?: string | null;
}

export type AuthReason =
  | "SuperAdmin"
  | "Owned"
  | {
      AllowedByPubliclyAccessible: {
        policy_id: AccessPolicyId;
      };
    }
  | {
      AllowedByServerAccessible: {
        policy_id: AccessPolicyId;
      };
    }
  | {
      AllowedByDirectUserPolicy: {
        policy_id: AccessPolicyId;
      };
    }
  | {
      AllowedByDirectUserGroupPolicy: {
        policy_id: AccessPolicyId;
        via_user_group_id: UserGroupId;
      };
    }
  | {
      AllowedByResourceGroupUserPolicy: {
        /** @format uuid */
        on_resource_group_id: string;
        policy_id: AccessPolicyId;
      };
    }
  | {
      AllowedByResourceGroupUserGroupPolicy: {
        /** @format uuid */
        on_resource_group_id: string;
        policy_id: AccessPolicyId;
        via_user_group_id: UserGroupId;
      };
    }
  | {
      DeniedByPubliclyAccessible: {
        policy_id: AccessPolicyId;
      };
    }
  | {
      DeniedByServerAccessible: {
        policy_id: AccessPolicyId;
      };
    }
  | {
      DeniedByDirectUserPolicy: {
        policy_id: AccessPolicyId;
      };
    }
  | {
      DeniedByDirectUserGroupPolicy: {
        policy_id: AccessPolicyId;
        via_user_group_id: UserGroupId;
      };
    }
  | {
      DeniedByResourceGroupUserPolicy: {
        /** @format uuid */
        on_resource_group_id: string;
        policy_id: AccessPolicyId;
      };
    }
  | {
      DeniedByResourceGroupUserGroupPolicy: {
        /** @format uuid */
        on_resource_group_id: string;
        policy_id: AccessPolicyId;
        via_user_group_id: UserGroupId;
      };
    }
  | "NoMatchingAllowPolicy"
  | "ResourceNotFound";

export interface CheckResourceAccessRequestBody {
  access_policy_action: AccessPolicyAction;
  access_policy_resource_type: AccessPolicyResourceType;
  requesting_app_origin?: string | null;
  resource_ids?: any[] | null;
}

export interface CheckResourceAccessResponseBody {
  auth_evaluations: AuthEvaluation[];
}

export interface CreateAccessPolicyRequestBody {
  access_policy_actions: AccessPolicyAction[];
  access_policy_effect: AccessPolicyEffect;
  /** @maxLength 256 */
  access_policy_name: string;
  access_policy_resource_type: AccessPolicyResourceType;
  access_policy_subject_id: AccessPolicySubjectId;
  access_policy_subject_type: AccessPolicySubjectType;
  context_app_ids: MowsAppId[];
  /** @format uuid */
  resource_id?: string | null;
}

export interface CreateAccessPolicyResponseBody {
  created_access_policy: AccessPolicy;
}

export interface CreateFileGroupRequestBody {
  dynamic_group_rule?: null | DynamicGroupRule;
  /** @maxLength 256 */
  file_group_name: string;
  file_group_type: FileGroupType;
}

export interface CreateFileGroupResponseBody {
  created_file_group: FileGroup;
}

export interface CreateFileRequestBody {
  /** @maxLength 256 */
  file_name: string;
  mime_type?: string | null;
  /** @format date-time */
  time_created?: string | null;
  /** @format date-time */
  time_modified?: string | null;
}

export interface CreateFileResponseBody {
  created_file: FilezFile;
}

export interface CreateFileVersionRequestBody {
  app_path?: string | null;
  /**
   * Optional SHA256 digest of the file content as a lowercase hexadecimal string.
   * Once the content is fully uploaded it automatically gets validated against this digest.
   * After successful validation, the versions content_valid field is set to true.
   * @minLength 64
   * @maxLength 64
   * @pattern ^[a-f0-9]{64}$
   */
  content_expected_sha256_digest?: string | null;
  /** The ID of the file to create a version for. */
  file_id: FilezFileId;
  file_version_metadata: FileVersionMetadata;
  /** The MIME type of the file version. */
  file_version_mime_type: string;
  /**
   * @format int32
   * @min 0
   */
  file_version_number?: number | null;
  /**
   * The size of the file version in bytes.
   * @format int64
   * @min 0
   */
  file_version_size: number;
  /** The ID of the storage quota to use for this file version. */
  storage_quota_id: StorageQuotaId;
}

export interface CreateFileVersionResponseBody {
  created_file_version: FileVersion;
}

export interface CreateJobRequestBody {
  /** @format date-time */
  job_deadline_time?: string | null;
  job_execution_details: JobExecutionInformation;
  job_handling_app_id: MowsAppId;
  /** @maxLength 256 */
  job_name: string;
  job_persistence: JobPersistenceType;
}

export interface CreateJobResponseBody {
  created_job: FilezJob;
}

export interface CreateStorageQuotaRequestBody {
  storage_location_id: StorageLocationId;
  /**
   * @format int64
   * @min 0
   */
  storage_quota_bytes: number;
  /** @maxLength 256 */
  storage_quota_name: string;
  storage_quota_subject_id: StorageQuotaSubjectId;
  storage_quota_subject_type: StorageQuotaSubjectType;
}

export interface CreateStorageQuotaResponseBody {
  created_storage_quota: StorageQuota;
}

export interface CreateUserGroupRequestBody {
  /** @maxLength 256 */
  user_group_name: string;
}

export interface CreateUserGroupResponseBody {
  created_user_group: UserGroup;
}

export interface CreateUserRequestBody {
  email: string;
}

export interface CreateUserResponseBody {
  created_user: FilezUser;
}

export type DeleteUserMethod =
  | {
      ById: FilezUserId;
    }
  | {
      ByExternalId: string;
    }
  | {
      ByEmail: string;
    };

export interface DeleteUserRequestBody {
  delete_user_method: DeleteUserMethod;
}

export type DynamicGroupRule = object;

export type EmptyApiResponse = object;

export interface FileGroup {
  /** @format date-time */
  created_time: string;
  dynamic_group_rule?: null | DynamicGroupRule;
  group_type: FileGroupType;
  id: FileGroupId;
  /** @format date-time */
  modified_time: string;
  name: string;
  owner_id: FilezUserId;
}

/** @format uuid */
export type FileGroupId = string;

export interface FileMetadata {
  default_preview_app_id?: null | MowsAppId;
  /** Extracted data from the file, such as text content, metadata, etc. */
  extracted_data: Record<string, any>;
  /**
   * Place for apps to store custom data related to the file.
   * every app is identified by its id, and can only access its own data.
   */
  private_app_data: Record<string, any>;
  /** Apps can provide and request shared app data from other apps on creation */
  shared_app_data: Record<string, any>;
}

export interface FileVersion {
  app_id: MowsAppId;
  app_path: string;
  content_expected_sha256_digest?: string | null;
  content_valid: boolean;
  /** @format date-time */
  created_time: string;
  file_id: FilezFileId;
  id: FileVersionId;
  metadata: FileVersionMetadata;
  mime_type: string;
  /** @format date-time */
  modified_time: string;
  /** @format int64 */
  size: number;
  storage_location_id: StorageLocationId;
  storage_quota_id: StorageQuotaId;
  /** @format int32 */
  version: number;
}

/** @format uuid */
export type FileVersionId = string;

export type FileVersionMetadata = object;

export interface FileVersionSizeExceededErrorBody {
  /**
   * @format int64
   * @min 0
   */
  allowed: number;
  /**
   * @format int64
   * @min 0
   */
  received: number;
}

export interface FilezFile {
  /** @format date-time */
  created_time: string;
  id: FilezFileId;
  metadata: FileMetadata;
  mime_type: string;
  /** @format date-time */
  modified_time: string;
  name: string;
  owner_id: FilezUserId;
}

/** @format uuid */
export type FilezFileId = string;

export interface FilezJob {
  /** The app that should handle the job */
  app_id: MowsAppId;
  /**
   * The last time the app instance has been seen by the server
   * This is used to determine if the app instance is still alive and can handle the job
   * @format date-time
   */
  app_instance_last_seen_time?: string | null;
  /** After the job is picked up by the app, this field will be set to the app instance id, created from the kubernetes pod UUID and a random string that the app generates on startup */
  assigned_app_runtime_instance_id?: string | null;
  /**
   * When the job was created in the database
   * @format date-time
   */
  created_time: string;
  /**
   * After the deadline the job will be marked as finished and failed if not completed
   * @format date-time
   */
  deadline_time?: string | null;
  /**
   * When the job was finished, either successfully or failed
   * @format date-time
   */
  end_time?: string | null;
  /** Details relevant for the execution of the job */
  execution_information: JobExecutionInformation;
  id: FilezJobId;
  /**
   * When the job was last modified in the database
   * @format date-time
   */
  modified_time: string;
  name: string;
  owner_id: FilezUserId;
  persistence: JobPersistenceType;
  /**
   * When the job was started, either automatically or manually
   * @format date-time
   */
  start_time?: string | null;
  /** The current status of the job */
  status: JobStatus;
  status_details?: null | JobStatusDetails;
}

/** @format uuid */
export type FilezJobId = string;

export interface FilezUser {
  created_by?: null | FilezUserId;
  /** @format date-time */
  created_time: string;
  deleted: boolean;
  /** The display name of the user, updated from the external identity provider on each login */
  display_name: string;
  /** The external user ID, e.g. from ZITADEL or other identity providers */
  external_user_id?: string | null;
  id: FilezUserId;
  /** @format date-time */
  modified_time: string;
  /** Used to create a user before the external user ID is known, when the user then logs in with a verified email address the email is switched to the external user ID */
  pre_identifier_email?: string | null;
  profile_picture?: null | FilezFileId;
  user_type: FilezUserType;
}

/** @format uuid */
export type FilezUserId = string;

export interface GetAccessPolicyRequestBody {
  access_policy_ids: AccessPolicyId[];
}

export interface GetAccessPolicyResponseBody {
  access_policies: AccessPolicy[];
}

export interface GetAppsResponseBody {
  apps: Record<string, MowsApp>;
}

export interface GetFileGroupsRequestBody {
  file_group_ids: FileGroupId[];
}

export interface GetFileGroupsResponseBody {
  file_groups: FileGroup[];
}

export interface GetFileVersionsRequestBody {
  file_version_ids: FileVersionId[];
}

export interface GetFileVersionsResponseBody {
  file_versions: FileVersion[];
}

export interface GetFilesResponseBody {
  files: FilezFile[];
}

export interface GetJobRequestBody {
  job_id: FilezJobId;
}

export interface GetJobResponseBody {
  job: FilezJob;
}

export interface GetOwnUserBody {
  user: FilezUser;
}

export interface GetStorageQuotaRequestBody {
  storage_quota_ids: StorageQuotaId[];
}

export interface GetStorageQuotaResponseBody {
  storage_quotas: StorageQuota[];
}

export interface GetTagsRequestBody {
  resource_ids: string[];
  tag_resource_type: TagResourceType;
}

export interface GetTagsResponseBody {
  resource_tags: Record<string, Record<string, string>>;
}

export interface GetUserGroupsRequestBody {
  /** The IDs of the user groups to retrieve */
  user_group_ids: UserGroupId[];
}

export interface GetUserGroupsResponseBody {
  /** The retrieved user groups */
  user_groups: UserGroup[];
}

export interface GetUsersReqBody {
  user_ids: FilezUserId[];
}

export interface GetUsersResBody {
  users_meta: Record<string, UserMeta>;
}

export interface HealthResBody {
  all_healthy: boolean;
  controller: HealthStatus;
  database: HealthStatus;
  storage_locations: Record<string, HealthStatus>;
  zitadel: HealthStatus;
}

export interface HealthStatus {
  healthy: boolean;
  response: string;
}

export interface JobExecutionInformation {
  job_type: JobType;
}

export type JobStatusDetails =
  | {
      Created: JobStatusDetailsCreated;
    }
  | {
      InProgress: JobStatusDetailsInProgress;
    }
  | {
      Completed: JobStatusDetailsCompleted;
    }
  | {
      Failed: JobStatusDetailsFailed;
    }
  | {
      Cancelled: JobStatusDetailsCancelled;
    };

export interface JobStatusDetailsCancelled {
  message: string;
  reason?: string | null;
}

export interface JobStatusDetailsCompleted {
  message: string;
}

export interface JobStatusDetailsCreated {
  message: string;
}

export interface JobStatusDetailsFailed {
  error?: string | null;
  message: string;
}

export interface JobStatusDetailsInProgress {
  message: string;
}

export type JobType = {
  /** Allows the app to create a set of previews for a existing file_version_number and file_id */
  CreatePreview: JobTypeCreatePreview;
};

/** Allows the app to create a set of previews for a existing file_version_number and file_id */
export interface JobTypeCreatePreview {
  allowed_mime_types: string[];
  /**
   * @format int32
   * @min 0
   */
  allowed_number_of_previews: number;
  /**
   * @format int64
   * @min 0
   */
  allowed_size_bytes: number;
  file_id: FilezFileId;
  /**
   * @format int32
   * @min 0
   */
  file_version_number: number;
  preview_config: object;
  storage_location_id: StorageLocationId;
  storage_quota_id: StorageQuotaId;
}

export interface ListAccessPoliciesRequestBody {
  /**
   * @format int64
   * @min 0
   */
  from_index?: number | null;
  /**
   * @format int64
   * @min 0
   */
  limit?: number | null;
  sort_by?: null | ListAccessPoliciesSortBy;
  sort_order?: null | SortDirection;
}

export interface ListAccessPoliciesResponseBody {
  access_policies: AccessPolicy[];
}

export type ListAppsRequestBody = object;

export interface ListAppsResponseBody {
  apps: MowsApp[];
}

export interface ListFileGroupsRequestBody {
  /**
   * @format int64
   * @min 0
   */
  from_index?: number | null;
  /**
   * @format int64
   * @min 0
   */
  limit?: number | null;
  sort_by?: null | ListFileGroupsSortBy;
  sort_order?: null | SortDirection;
}

export interface ListFileGroupsResponseBody {
  file_groups: FileGroup[];
}

export interface ListFilesRequestBody {
  file_group_id: FileGroupId;
  /**
   * @format int64
   * @min 0
   */
  from_index?: number | null;
  /**
   * @format int64
   * @min 0
   */
  limit?: number | null;
  sort?: null | ListFilesSorting;
}

export interface ListFilesResponseBody {
  files: FilezFile[];
  /**
   * @format int64
   * @min 0
   */
  total_count: number;
}

export interface ListFilesSortOrder {
  sort_by: ListFilesSortBy;
  sort_order?: null | SortDirection;
}

export type ListFilesSorting =
  | {
      StoredSortOrder: ListFilesStoredSortOrder;
    }
  | {
      SortOrder: ListFilesSortOrder;
    };

export interface ListFilesStoredSortOrder {
  direction?: null | SortDirection;
  /** @format uuid */
  stored_sort_order_id: string;
}

export interface ListJobsRequestBody {
  /**
   * @format int64
   * @min 0
   */
  from_index?: number | null;
  /**
   * @format int64
   * @min 0
   */
  limit?: number | null;
  sort_by?: null | ListJobsSortBy;
  sort_order?: null | SortDirection;
}

export interface ListJobsResponseBody {
  jobs: FilezJob[];
}

export interface ListStorageLocationsRequestBody {
  sort_by?: null | ListStorageLocationsSortBy;
  sort_order?: null | SortDirection;
}

export interface ListStorageLocationsResponseBody {
  storage_locations: StorageLocationListItem[];
}

export interface ListStorageQuotasRequestBody {
  /**
   * @format int64
   * @min 0
   */
  from_index?: number | null;
  /**
   * @format int64
   * @min 0
   */
  limit?: number | null;
  sort_by?: null | ListStorageQuotasSortBy;
  sort_order?: null | SortDirection;
}

export interface ListStorageQuotasResponseBody {
  storage_quotas: StorageQuota[];
}

export interface ListUserGroupsRequestBody {
  /**
   * @format int64
   * @min 0
   */
  from_index?: number | null;
  /**
   * @format int64
   * @min 0
   */
  limit?: number | null;
  sort_by?: null | ListUserGroupsSortBy;
  sort_order?: null | SortDirection;
}

export interface ListUserGroupsResponseBody {
  user_groups: UserGroup[];
}

export interface ListUsersRequestBody {
  /**
   * @format int64
   * @min 0
   */
  from_index?: number | null;
  /**
   * @format int64
   * @min 0
   */
  limit?: number | null;
  sort_by?: string | null;
  sort_order?: null | SortDirection;
  user_group_id: UserGroupId;
}

export interface ListUsersResponseBody {
  /**
   * @format int64
   * @min 0
   */
  total_count: number;
  users: FilezUser[];
}

export interface ListedFilezUser {
  /** @format date-time */
  created_time: string;
  display_name: string;
  id: FilezUserId;
}

/**
 * # Backend Apps
 * Pods can authenticate as apps using their Kubernetes service account token
 * Backend apps can act on behalf of users by picking up jobs created by users
 * # Frontend Apps
 * Frontend Apps are recognized by their origin that is sent with the browser request
 * They can act on behalf of users if an access policy allows it
 */
export interface MowsApp {
  app_type: AppType;
  /** @format date-time */
  created_time: string;
  description?: string | null;
  /** Unique identifier for the app in the database, this is used to identify the app in all database operations */
  id: MowsAppId;
  /** @format date-time */
  modified_time: string;
  /**
   * Name and Namespace of the app in Kubernetes
   * Renaming an app in Kubernetes will not change the name in the database but create a new app with the new name
   * Generally the name should not be changed, if it is it can be manually adjusted in the database
   */
  name: string;
  /**
   * Origins are used to identify the app in the browser, all origins must be unique across all apps
   * If an app has no origins, it is considered a backend app
   */
  origins?: any[] | null;
  /** If a app is marked as trusted, it can access all resources without any restrictions */
  trusted: boolean;
}

/** @format uuid */
export type MowsAppId = string;

export type PickupJobRequestBody = object;

export interface PickupJobResponseBody {
  job?: null | FilezJob;
}

/** @format uuid */
export type StorageLocationId = string;

export interface StorageLocationListItem {
  /** @format date-time */
  created_time: string;
  id: StorageLocationId;
  /** @format date-time */
  modified_time: string;
  name: string;
}

export interface StorageQuota {
  /** @format date-time */
  created_time: string;
  id: StorageQuotaId;
  /** @format date-time */
  modified_time: string;
  name: string;
  owner_id: FilezUserId;
  /** @format int64 */
  quota_bytes: number;
  storage_location_id: StorageLocationId;
  subject_id: StorageQuotaSubjectId;
  subject_type: StorageQuotaSubjectType;
}

/** @format uuid */
export type StorageQuotaId = string;

/** @format uuid */
export type StorageQuotaSubjectId = string;

export interface UpdateAccessPolicyChangeset {
  new_access_policy_actions?: any[] | null;
  new_access_policy_effect?: null | AccessPolicyEffect;
  /** @maxLength 256 */
  new_access_policy_name?: string | null;
  new_access_policy_resource_type?: null | AccessPolicyResourceType;
  new_access_policy_subject_id?: null | AccessPolicySubjectId;
  new_access_policy_subject_type?: null | AccessPolicySubjectType;
  new_context_app_ids?: any[] | null;
  /** @format uuid */
  new_resource_id?: string | null;
}

export interface UpdateAccessPolicyRequestBody {
  access_policy_id: AccessPolicyId;
  changeset: UpdateAccessPolicyChangeset;
}

export interface UpdateAccessPolicyResponseBody {
  updated_access_policy: AccessPolicy;
}

export interface UpdateFileChangeset {
  new_file_metadata?: null | FileMetadata;
  new_file_mime_type?: string | null;
  /** @maxLength 256 */
  new_file_name?: string | null;
}

export interface UpdateFileGroupChangeset {
  /** @maxLength 256 */
  new_file_group_name?: string | null;
}

export interface UpdateFileGroupMembersRequestBody {
  file_group_id: FileGroupId;
  files_to_add?: any[] | null;
  files_to_remove?: any[] | null;
}

export interface UpdateFileGroupRequestBody {
  changeset: UpdateFileGroupChangeset;
  file_group_id: FileGroupId;
}

export interface UpdateFileGroupResponseBody {
  updated_file_group: FileGroup;
}

export interface UpdateFileRequestBody {
  changeset: UpdateFileChangeset;
  file_id: FilezFileId;
}

export interface UpdateFileResponseBody {
  updated_file: FilezFile;
}

export interface UpdateFileVersionChangeset {
  /**
   * @minLength 64
   * @maxLength 64
   * @pattern ^[a-f0-9]{64}$
   */
  new_content_expected_sha256_digest?: string | null;
  new_file_version_metadata?: null | FileVersionMetadata;
  new_file_version_mime_type?: string | null;
}

export interface UpdateFileVersionsRequestBody {
  changeset: UpdateFileVersionChangeset;
  file_version_id: FileVersionId;
}

export interface UpdateFileVersionsResponseBody {
  updated_file_version: FileVersion;
}

export interface UpdateJobChangeset {
  /** @format date-time */
  new_job_deadline_time?: string | null;
  new_job_execution_information?: null | JobExecutionInformation;
  /** @maxLength 256 */
  new_job_name?: string | null;
  new_job_persistence?: null | JobPersistenceType;
}

export interface UpdateJobRequestBody {
  changeset: UpdateJobChangeset;
  job_id: FilezJobId;
}

export interface UpdateJobResponseBody {
  job: FilezJob;
}

export interface UpdateJobStatusRequestBody {
  new_job_status_details?: null | JobStatusDetails;
  new_status: JobStatus;
}

export interface UpdateJobStatusResponseBody {
  updated_job: FilezJob;
}

export interface UpdateStorageQuotaChangeset {
  /** @format int64 */
  new_storage_quota_bytes?: number | null;
}

export interface UpdateStorageQuotaRequestBody {
  changeset: UpdateStorageQuotaChangeset;
  storage_quota_id: StorageQuotaId;
}

export interface UpdateStorageQuotaResponseBody {
  updated_storage_quota: StorageQuota;
}

export type UpdateTagsMethod =
  | {
      Add: Record<string, string>;
    }
  | {
      Remove: Record<string, string>;
    }
  | {
      Set: Record<string, string>;
    }
  | "Clear";

export interface UpdateTagsRequestBody {
  resource_ids: string[];
  tag_resource_type: TagResourceType;
  update_tags: UpdateTagsMethod;
}

export interface UpdateUserGroupChangeset {
  /** @maxLength 256 */
  new_user_group_name?: string | null;
}

export interface UpdateUserGroupMembersRequestBody {
  user_group_id: UserGroupId;
  users_to_add?: any[] | null;
  users_to_remove?: any[] | null;
}

export interface UpdateUserGroupRequestBody {
  changeset: UpdateUserGroupChangeset;
  user_group_id: UserGroupId;
}

export interface UpdateUserGroupResponseBody {
  updated_user_group: UserGroup;
}

export interface UserGroup {
  /** @format date-time */
  created_time: string;
  id: UserGroupId;
  /** @format date-time */
  modified_time: string;
  name: string;
  owner_id: FilezUserId;
}

/** @format uuid */
export type UserGroupId = string;

export interface UserMeta {
  user: FilezUser;
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown>
  extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  JsonApi = "application/vnd.api+json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
  Binary = "application/octet-stream",
  BinaryWithOffset = "application/offset+octet-stream",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) =>
    fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => "undefined" !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.JsonApi]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== "string"
        ? JSON.stringify(input)
        : input,
    [ContentType.FormData]: (input: any) =>
      Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData()),
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
    [ContentType.Binary]: (input: any) => input,
    [ContentType.BinaryWithOffset]: (input: any) => input,
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (
    cancelToken: CancelToken,
  ): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData
            ? { "Content-Type": type }
            : {}),
        },
        signal:
          (cancelToken
            ? this.createAbortSignal(cancelToken)
            : requestParams.signal) || null,
        body:
          typeof body === "undefined" || body === null
            ? null
            : payloadFormatter(body),
      },
    ).then(async (response) => {
      const r = response.clone() as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const data = !responseFormat
        ? r
        : await response[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title filez-server
 * @version 0.0.1
 * @license
 *
 * API for managing files in MOWS Filez
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  api = {
    /**
     * @description Check if the user has access to the requested resources
     *
     * @name CheckResourceAccess
     * @request POST:/api/access_policies/check
     */
    checkResourceAccess: (
      data: CheckResourceAccessRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseCheckResourceAccessResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/access_policies/check`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new access policy
     *
     * @name CreateAccessPolicy
     * @request POST:/api/access_policies/create
     */
    createAccessPolicy: (
      data: CreateAccessPolicyRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseCreateAccessPolicyResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/access_policies/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete an access policy by its ID
     *
     * @name DeleteAccessPolicy
     * @request DELETE:/api/access_policies/delete/{access_policy_id}
     */
    deleteAccessPolicy: (
      accessPolicyId: AccessPolicyId,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/access_policies/delete/${accessPolicyId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * @description Get access policies from the server by their IDs
     *
     * @name GetAccessPolicy
     * @request POST:/api/access_policies/get
     */
    getAccessPolicy: (
      data: GetAccessPolicyRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseGetAccessPolicyResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/access_policies/get`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description List access policies from the server
     *
     * @name ListAccessPolicies
     * @request POST:/api/access_policies/list
     */
    listAccessPolicies: (
      data: ListAccessPoliciesRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseListAccessPoliciesResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/access_policies/list`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update an existing access policy
     *
     * @name UpdateAccessPolicy
     * @request PUT:/api/access_policies/update
     */
    updateAccessPolicy: (
      data: UpdateAccessPolicyRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseUpdateAccessPolicyResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/access_policies/update`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get apps from the server
     *
     * @name GetApps
     * @request POST:/api/apps/get
     */
    getApps: (params: RequestParams = {}) =>
      this.request<ApiResponseGetAppsResponseBody, ApiResponseEmptyApiResponse>(
        {
          path: `/api/apps/get`,
          method: "POST",
          format: "json",
          ...params,
        },
      ),

    /**
     * @description List apps from the server
     *
     * @name ListApps
     * @request POST:/api/apps/list
     */
    listApps: (data: ListAppsRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseListAppsResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/apps/list`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new file group
     *
     * @name CreateFileGroup
     * @request POST:/api/file_groups/create
     */
    createFileGroup: (
      data: CreateFileGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseCreateFileGroupResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/file_groups/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a file group by its ID
     *
     * @name DeleteFileGroup
     * @request DELETE:/api/file_groups/delete/{file_group_id}
     */
    deleteFileGroup: (fileGroupId: FileGroupId, params: RequestParams = {}) =>
      this.request<ApiResponseString, ApiResponseEmptyApiResponse>({
        path: `/api/file_groups/delete/${fileGroupId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * @description Gets file groups by their IDs
     *
     * @name GetFileGroup
     * @request GET:/api/file_groups/get
     */
    getFileGroup: (
      data: GetFileGroupsRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseGetFileGroupsResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/file_groups/get`,
        method: "GET",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description List file groups
     *
     * @name ListFileGroups
     * @request POST:/api/file_groups/list
     */
    listFileGroups: (
      data: ListFileGroupsRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseListFileGroupsResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/file_groups/list`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Lists files in a file group
     *
     * @name ListFilesByFileGroups
     * @request POST:/api/file_groups/list_files
     */
    listFilesByFileGroups: (
      data: ListFilesRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseListFilesResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/file_groups/list_files`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update a file group
     *
     * @name UpdateFileGroup
     * @request PUT:/api/file_groups/update
     */
    updateFileGroup: (
      data: UpdateFileGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseUpdateFileGroupResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/file_groups/update`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update the members of a file group
     *
     * @name UpdateFileGroupMembers
     * @request POST:/api/file_groups/update_members
     */
    updateFileGroupMembers: (
      data: UpdateFileGroupMembersRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/file_groups/update_members`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get the content of a file version.
     *
     * @name GetFileVersionContent
     * @request GET:/api/file_versions/content/get/{file_id}/{version}/{app_id}/{app_path}
     */
    getFileVersionContent: (
      fileId: string,
      version: number | null,
      appId: string | null,
      appPath: string | null,
      query?: {
        /** If set to true, the content disposition header will be set to attachment */
        disposition?: boolean;
        /**
         * If set, the cache control header will be set to public, max-age={c}
         * @format int64
         * @min 0
         */
        cache?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<number[], ApiResponseEmptyApiResponse>({
        path: `/api/file_versions/content/get/${fileId}/${version}/${appId}/${appPath}`,
        method: "GET",
        query: query,
        ...params,
      }),

    /**
     * @description Get the offset of a file version for resuming a Tus upload
     *
     * @name FileVersionsContentTusHead
     * @request HEAD:/api/file_versions/content/tus/{file_id}/{version}/{app_id}/{app_path}
     */
    fileVersionsContentTusHead: (
      fileId: string,
      version: number | null,
      appId: string | null,
      appPath: string | null,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/file_versions/content/tus/${fileId}/${version}/${appId}/${appPath}`,
        method: "HEAD",
        format: "json",
        ...params,
      }),

    /**
     * @description Patch a file version using the TUS protocol. The file and the file version must exist. If the file version is marked as verified it cannot be patched, unless the expected checksum is updated or removed.
     *
     * @tags FileVersion
     * @name FileVersionsContentTusPatch
     * @request PATCH:/api/file_versions/content/tus/{file_id}/{version}/{app_path}
     */
    fileVersionsContentTusPatch: (
      fileId: string,
      version: number | null,
      appPath: string | null,
      data: any,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseEmptyApiResponse,
        | ApiResponseEmptyApiResponse
        | ApiResponseFileVersionSizeExceededErrorBody
      >({
        path: `/api/file_versions/content/tus/${fileId}/${version}/${appPath}`,
        method: "PATCH",
        body: data,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new file version entry in the database
     *
     * @name CreateFileVersion
     * @request POST:/api/file_versions/create
     */
    createFileVersion: (
      data: CreateFileVersionRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseCreateFileVersionResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/file_versions/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete file versions in the database
     *
     * @name DeleteFileVersions
     * @request DELETE:/api/file_versions/delete/{file_version_id}
     */
    deleteFileVersions: (
      fileVersionId: FileVersionId,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/file_versions/delete/${fileVersionId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * @description Get file versions from the server
     *
     * @name GetFileVersions
     * @request POST:/api/file_versions/get
     */
    getFileVersions: (
      data: GetFileVersionsRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseGetFileVersionsResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/file_versions/get`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Updates a file version in the database
     *
     * @name UpdateFileVersion
     * @request POST:/api/file_versions/update
     */
    updateFileVersion: (
      data: UpdateFileVersionsRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseUpdateFileVersionsResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/file_versions/update`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new file entry in the database
     *
     * @name CreateFile
     * @request POST:/api/files/create
     */
    createFile: (data: CreateFileRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseCreateFileResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/files/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a file entry in the database
     *
     * @name DeleteFile
     * @request DELETE:/api/files/delete/{file_id}
     */
    deleteFile: (fileId: FilezFileId, params: RequestParams = {}) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/files/delete/${fileId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * @description Get files from the server, NOT their content
     *
     * @name GetFiles
     * @request POST:/api/files/get
     */
    getFiles: (params: RequestParams = {}) =>
      this.request<
        ApiResponseGetFilesResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/files/get`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * @description Update a file entry in the database, NOT the content of the file itself.
     *
     * @name UpdateFile
     * @request POST:/api/files/update
     */
    updateFile: (data: UpdateFileRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseUpdateFileResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/files/update`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get the health status of the service
     *
     * @name GetHealth
     * @request GET:/api/health
     */
    getHealth: (params: RequestParams = {}) =>
      this.request<ApiResponseHealthResBody, ApiResponseHealthResBody>({
        path: `/api/health`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Pickup a job from the server
     *
     * @name PickupJob
     * @request POST:/api/jobs/apps/pickup
     */
    pickupJob: (data: PickupJobRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponsePickupJobResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/jobs/apps/pickup`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Updates the status of a job on the server
     *
     * @name UpdateJobStatus
     * @request POST:/api/jobs/apps/update_status
     */
    updateJobStatus: (
      data: UpdateJobStatusRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseUpdateJobStatusResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/jobs/apps/update_status`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new job in the database
     *
     * @name CreateJob
     * @request POST:/api/jobs/create
     */
    createJob: (data: CreateJobRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseCreateJobResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/jobs/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a job from the database
     *
     * @name DeleteJob
     * @request DELETE:/api/jobs/delete/{job_id}
     */
    deleteJob: (jobId: FilezJobId, params: RequestParams = {}) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/jobs/delete/${jobId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * @description Get a job from the database
     *
     * @name GetJob
     * @request POST:/api/jobs/get
     */
    getJob: (data: GetJobRequestBody, params: RequestParams = {}) =>
      this.request<ApiResponseGetJobResponseBody, ApiResponseEmptyApiResponse>({
        path: `/api/jobs/get`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description List jobs from the database
     *
     * @name ListJobs
     * @request POST:/api/jobs/list
     */
    listJobs: (data: ListJobsRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseListJobsResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/jobs/list`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update a job in the database
     *
     * @name UpdateJob
     * @request POST:/api/jobs/update
     */
    updateJob: (data: UpdateJobRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseUpdateJobResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/jobs/update`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description List storage locations from the database
     *
     * @name ListStorageLocations
     * @request POST:/api/storage_locations/list
     */
    listStorageLocations: (
      data: ListStorageLocationsRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseListStorageLocationsResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/storage_locations/list`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new storage quota in the database
     *
     * @name CreateStorageQuota
     * @request POST:/api/storage_quotas/create
     */
    createStorageQuota: (
      data: CreateStorageQuotaRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseCreateStorageQuotaResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/storage_quotas/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a storage quota by its ID
     *
     * @name DeleteStorageQuota
     * @request DELETE:/api/storage_quotas/delete/{storage_quota_id}
     */
    deleteStorageQuota: (
      storageQuotaId: StorageQuotaId,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/storage_quotas/delete/${storageQuotaId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * @description Get storage quotas by their IDs
     *
     * @name GetStorageQuotas
     * @request POST:/api/storage_quotas/get
     */
    getStorageQuotas: (
      data: GetStorageQuotaRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseGetStorageQuotaResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/storage_quotas/get`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description List storage quotas
     *
     * @name ListStorageQuotas
     * @request POST:/api/storage_quotas/list
     */
    listStorageQuotas: (
      data: ListStorageQuotasRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseListStorageQuotasResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/storage_quotas/list`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update an existing storage quota in the database
     *
     * @name UpdateStorageQuota
     * @request PUT:/api/storage_quotas/update
     */
    updateStorageQuota: (
      data: UpdateStorageQuotaRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseUpdateStorageQuotaResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/storage_quotas/update`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get the tags for the specified resources, resources must be of the same type per query.
     *
     * @name GetTags
     * @request POST:/api/tags/get
     */
    getTags: (data: GetTagsRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseGetTagsResponseBody,
        ApiResponseGetTagsResponseBody
      >({
        path: `/api/tags/get`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update the tags for the specified resources, resources must be of the same type per query. The same operation is applied to all resources in the list.
     *
     * @name UpdateTags
     * @request POST:/api/tags/update
     */
    updateTags: (data: UpdateTagsRequestBody, params: RequestParams = {}) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/tags/update`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new user group in the database
     *
     * @name CreateUserGroup
     * @request POST:/api/user_groups/create
     */
    createUserGroup: (
      data: CreateUserGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseCreateUserGroupResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/user_groups/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a user group by its ID
     *
     * @name DeleteUserGroup
     * @request DELETE:/api/user_groups/delete/{user_group_id}
     */
    deleteUserGroup: (userGroupId: string, params: RequestParams = {}) =>
      this.request<ApiResponseString, ApiResponseEmptyApiResponse>({
        path: `/api/user_groups/delete/${userGroupId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * @description Get user groups by their IDs
     *
     * @name GetUserGroups
     * @request POST:/api/user_groups/get
     */
    getUserGroups: (
      data: GetUserGroupsRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseGetUserGroupsResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/user_groups/get`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ListUserGroups
     * @request POST:/api/user_groups/list
     */
    listUserGroups: (
      data: ListUserGroupsRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseListUserGroupsResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/user_groups/list`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description List users in a user group by the user group ID
     *
     * @name ListUsersByUserGroup
     * @request POST:/api/user_groups/list_users
     */
    listUsersByUserGroup: (
      data: ListUsersRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseListUsersResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/user_groups/list_users`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update an existing user group in the database
     *
     * @name UpdateUserGroup
     * @request PUT:/api/user_groups/update
     */
    updateUserGroup: (
      data: UpdateUserGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseUpdateUserGroupResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/user_groups/update`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update the members of a user group by adding or removing users
     *
     * @name UpdateUserGroupMembers
     * @request POST:/api/user_groups/update_members
     */
    updateUserGroupMembers: (
      data: UpdateUserGroupMembersRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/user_groups/update_members`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new user in the database
     *
     * @name CreateUser
     * @request POST:/api/users/create
     */
    createUser: (data: CreateUserRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseCreateUserResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/users/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a user from the database
     *
     * @name DeleteUser
     * @request POST:/api/users/delete
     */
    deleteUser: (data: DeleteUserRequestBody, params: RequestParams = {}) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/users/delete`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get users by their IDs
     *
     * @name GetUsers
     * @request POST:/api/users/get
     */
    getUsers: (data: GetUsersReqBody, params: RequestParams = {}) =>
      this.request<ApiResponseGetUsersResBody, ApiResponseEmptyApiResponse>({
        path: `/api/users/get`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get own user
     *
     * @name GetOwnUser
     * @request POST:/api/users/get_own
     */
    getOwnUser: (params: RequestParams = {}) =>
      this.request<ApiResponseGetOwnUserBody, ApiResponseEmptyApiResponse>({
        path: `/api/users/get_own`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * @description List users in the database with pagination and sorting
     *
     * @name ListUsers
     * @request POST:/api/users/list
     */
    listUsers: (data: ListUsersRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseListUsersResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/users/list`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
}
