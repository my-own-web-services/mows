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

export enum UpdateFilesMetaTypeTagsMethod {
  Add = "Add",
  Remove = "Remove",
  Set = "Set",
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

export enum FileGroupType {
  Manual = "Manual",
  Dynamic = "Dynamic",
}

export enum ApiResponseStatus {
  Success = "Success",
  Error = "Error",
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
  FilezFilesMetaGet = "FilezFilesMetaGet",
  FilezFilesMetaList = "FilezFilesMetaList",
  FilezFilesMetaUpdate = "FilezFilesMetaUpdate",
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
}

export interface AccessPolicy {
  actions: AccessPolicyAction[];
  /** @format uuid */
  context_app_id?: string | null;
  /** @format date-time */
  created_time: string;
  effect: AccessPolicyEffect;
  /** @format uuid */
  id: string;
  /** @format date-time */
  modified_time: string;
  name: string;
  /** @format uuid */
  owner_id: string;
  /** @format uuid */
  resource_id?: string | null;
  resource_type: AccessPolicyResourceType;
  /** @format uuid */
  subject_id: string;
  subject_type: AccessPolicySubjectType;
}

export interface ApiResponseAccessPolicy {
  data?: {
    actions: AccessPolicyAction[];
    /** @format uuid */
    context_app_id?: string | null;
    /** @format date-time */
    created_time: string;
    effect: AccessPolicyEffect;
    /** @format uuid */
    id: string;
    /** @format date-time */
    modified_time: string;
    name: string;
    /** @format uuid */
    owner_id: string;
    /** @format uuid */
    resource_id?: string | null;
    resource_type: AccessPolicyResourceType;
    /** @format uuid */
    subject_id: string;
    subject_type: AccessPolicySubjectType;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseApplyUserResponseBody {
  data?: {
    user: FilezUser;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCheckResourceAccessResponseBody {
  data?: {
    auth_evaluations: AuthEvaluation[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateFileResponseBody {
  data?: {
    id: string;
    mime_type: string;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateFileVersionResponseBody {
  data?: {
    version: FileVersion;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateStorageQuotaResponseBody {
  data?: {
    storage_quota: StorageQuota;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateUserResponseBody {
  data?: {
    /** @format uuid */
    id: string;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseDeleteFileResponseBody {
  data?: {
    /** @format uuid */
    file_id: string;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseDeleteFileVersionsResponseBody {
  data?: {
    versions: FileVersionIdentifier[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseDeleteUserResponseBody {
  data?: {
    /** @format uuid */
    user_id: string;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseEmptyApiResponse {
  /** @default null */
  data?: any;
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseFileGroup {
  data?: {
    /** @format date-time */
    created_time: string;
    dynamic_group_rule?: null | DynamicGroupRule;
    group_type: FileGroupType;
    /** @format uuid */
    id: string;
    /** @format date-time */
    modified_time: string;
    name: string;
    /** @format uuid */
    owner_id: string;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetFileVersionsResponseBody {
  data?: {
    versions: FileVersion[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetFilesMetaResBody {
  data?: {
    files_meta: Record<string, FileMeta>;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseGetFilesResponseBody {
  data?: {
    files: Record<string, FilezFile>;
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
    /** @format int64 */
    total_count: number;
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

export interface ApiResponseListUserGroupsResponseBody {
  data?: {
    user_groups: UserGroup[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseListUsersResponseBody {
  data?: {
    /** @format int64 */
    total_count: number;
    users: FilezUser[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseStorageQuota {
  data?: {
    /** @format date-time */
    created_time: string;
    /** @format uuid */
    id: string;
    /** @format date-time */
    modified_time: string;
    name: string;
    /** @format uuid */
    owner_id: string;
    /** @format int64 */
    quota_bytes: number;
    /** @format uuid */
    storage_location_id: string;
    /** @format uuid */
    subject_id: string;
    subject_type: AccessPolicySubjectType;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseString {
  data?: string;
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUpdateFileResponseBody {
  data?: {
    file: FilezFile;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUpdateFileVersionsResponseBody {
  data?: {
    versions: FileVersion[];
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseUserGroup {
  data?: {
    /** @format date-time */
    created_time: string;
    /** @format uuid */
    id: string;
    /** @format date-time */
    modified_time: string;
    name: string;
    /** @format uuid */
    owner_id: string;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseVecStorageQuota {
  data?: {
    /** @format date-time */
    created_time: string;
    /** @format uuid */
    id: string;
    /** @format date-time */
    modified_time: string;
    name: string;
    /** @format uuid */
    owner_id: string;
    /** @format int64 */
    quota_bytes: number;
    /** @format uuid */
    storage_location_id: string;
    /** @format uuid */
    subject_id: string;
    subject_type: AccessPolicySubjectType;
  }[];
  message: string;
  status: ApiResponseStatus;
}

export interface ApplyUserResponseBody {
  user: FilezUser;
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
        /** @format uuid */
        policy_id: string;
      };
    }
  | {
      AllowedByServerAccessible: {
        /** @format uuid */
        policy_id: string;
      };
    }
  | {
      AllowedByDirectUserPolicy: {
        /** @format uuid */
        policy_id: string;
      };
    }
  | {
      AllowedByDirectGroupPolicy: {
        /** @format uuid */
        policy_id: string;
        /** @format uuid */
        via_user_group_id: string;
      };
    }
  | {
      AllowedByResourceGroupUserPolicy: {
        /** @format uuid */
        on_resource_group_id: string;
        /** @format uuid */
        policy_id: string;
      };
    }
  | {
      AllowedByResourceGroupUserGroupPolicy: {
        /** @format uuid */
        on_resource_group_id: string;
        /** @format uuid */
        policy_id: string;
        /** @format uuid */
        via_user_group_id: string;
      };
    }
  | {
      DeniedByPubliclyAccessible: {
        /** @format uuid */
        policy_id: string;
      };
    }
  | {
      DeniedByServerAccessible: {
        /** @format uuid */
        policy_id: string;
      };
    }
  | {
      DeniedByDirectUserPolicy: {
        /** @format uuid */
        policy_id: string;
      };
    }
  | {
      DeniedByDirectGroupPolicy: {
        /** @format uuid */
        policy_id: string;
        /** @format uuid */
        via_user_group_id: string;
      };
    }
  | {
      DeniedByResourceGroupUserPolicy: {
        /** @format uuid */
        on_resource_group_id: string;
        /** @format uuid */
        policy_id: string;
      };
    }
  | {
      DeniedByResourceGroupUserGroupPolicy: {
        /** @format uuid */
        on_resource_group_id: string;
        /** @format uuid */
        policy_id: string;
        /** @format uuid */
        via_user_group_id: string;
      };
    }
  | "NoMatchingAllowPolicy"
  | "ResourceNotFound";

export interface CheckResourceAccessRequestBody {
  action: AccessPolicyAction;
  requesting_app_origin?: string | null;
  resource_ids?: any[] | null;
  resource_type: AccessPolicyResourceType;
}

export interface CheckResourceAccessResponseBody {
  auth_evaluations: AuthEvaluation[];
}

export interface CreateAccessPolicyRequestBody {
  actions: AccessPolicyAction[];
  /** @format uuid */
  context_app_id?: string | null;
  effect: AccessPolicyEffect;
  name: string;
  /** @format uuid */
  resource_id?: string | null;
  resource_type: AccessPolicyResourceType;
  /** @format uuid */
  subject_id: string;
  subject_type: AccessPolicySubjectType;
}

export interface CreateFileGroupRequestBody {
  dynamic_group_rule?: null | DynamicGroupRule;
  group_type: FileGroupType;
  name: string;
}

export interface CreateFileRequestBody {
  file_name: string;
  mime_type?: string | null;
  /** @format date-time */
  time_created?: string | null;
  /** @format date-time */
  time_modified?: string | null;
}

export interface CreateFileResponseBody {
  id: string;
  mime_type: string;
}

export interface CreateFileVersionRequestBody {
  app_path?: string | null;
  content_expected_sha256_digest?: string | null;
  /** @format uuid */
  file_id: string;
  metadata: FileVersionMetadata;
  /** @format int64 */
  size: number;
  /** @format uuid */
  storage_quota_id: string;
}

export interface CreateFileVersionResponseBody {
  version: FileVersion;
}

export interface CreateStorageQuotaRequestBody {
  name: string;
  /** @format int64 */
  quota_bytes: number;
  /** @format uuid */
  storage_location_id: string;
  /** @format uuid */
  subject_id: string;
  subject_type: AccessPolicySubjectType;
}

export interface CreateStorageQuotaResponseBody {
  storage_quota: StorageQuota;
}

export interface CreateUserGroupRequestBody {
  name: string;
}

export interface CreateUserRequestBody {
  email: string;
}

export interface CreateUserResponseBody {
  /** @format uuid */
  id: string;
}

export interface DeleteFileRequestBody {
  /** @format uuid */
  file_id: string;
}

export interface DeleteFileResponseBody {
  /** @format uuid */
  file_id: string;
}

export interface DeleteFileVersionsRequestBody {
  versions: FileVersionIdentifier[];
}

export interface DeleteFileVersionsResponseBody {
  versions: FileVersionIdentifier[];
}

export interface DeleteStorageQuotaRequestBody {
  /** @format uuid */
  storage_location_id: string;
  /** @format uuid */
  subject_id: string;
  subject_type: AccessPolicySubjectType;
}

export type DeleteUserMethod =
  | {
      /** @format uuid */
      ById: string;
    }
  | {
      ByExternalId: string;
    }
  | {
      ByEmail: string;
    };

export interface DeleteUserRequestBody {
  method: DeleteUserMethod;
}

export interface DeleteUserResponseBody {
  /** @format uuid */
  user_id: string;
}

export type DynamicGroupRule = object;

/** @default null */
export type EmptyApiResponse = any;

export interface FileGroup {
  /** @format date-time */
  created_time: string;
  dynamic_group_rule?: null | DynamicGroupRule;
  group_type: FileGroupType;
  /** @format uuid */
  id: string;
  /** @format date-time */
  modified_time: string;
  name: string;
  /** @format uuid */
  owner_id: string;
}

export interface FileMeta {
  file: FilezFile;
  tags: Record<string, string>;
}

export interface FileMetadata {
  /** @format uuid */
  default_preview_app_id?: string | null;
  /** Extracted data from the file, such as text content, metadata, etc. */
  extracted_data: any;
  /**
   * Place for apps to store custom data related to the file.
   * every app is identified by its id, and can only access its own data.
   */
  private_app_data: Record<string, any>;
  /** Apps can provide and request shared app data from other apps on creation */
  shared_app_data: Record<string, any>;
}

export interface FileVersion {
  /** @format uuid */
  app_id: string;
  app_path: string;
  content_expected_sha256_digest?: string | null;
  content_valid: boolean;
  /** @format date-time */
  created_time: string;
  /** @format uuid */
  file_id: string;
  metadata: FileVersionMetadata;
  /** @format date-time */
  modified_time: string;
  /** @format int64 */
  size: number;
  /** @format uuid */
  storage_location_id: string;
  /** @format uuid */
  storage_quota_id: string;
  /** @format int32 */
  version: number;
}

export interface FileVersionIdentifier {
  /** @format uuid */
  app_id: string;
  app_path: string;
  /** @format uuid */
  file_id: string;
  /** @format int32 */
  version: number;
}

export type FileVersionMetadata = object;

export interface FilezFile {
  /** @format date-time */
  created_time: string;
  /** @format uuid */
  id: string;
  metadata: FileMetadata;
  mime_type: string;
  /** @format date-time */
  modified_time: string;
  name: string;
  /** @format uuid */
  owner_id: string;
}

export interface FilezUser {
  /** @format uuid */
  created_by?: string | null;
  /** @format date-time */
  created_time: string;
  deleted: boolean;
  display_name: string;
  external_user_id?: string | null;
  /** @format uuid */
  id: string;
  /** @format date-time */
  modified_time: string;
  /** Used to create a user before the external user ID is known, when the user then logs in with a verified email address the email is switched to the external user ID */
  pre_identifier_email?: string | null;
  /** @format uuid */
  profile_picture?: string | null;
  super_admin: boolean;
}

export interface GetFileVersionsRequestBody {
  versions: FileVersionIdentifier[];
}

export interface GetFileVersionsResponseBody {
  versions: FileVersion[];
}

export interface GetFilesMetaRequestBody {
  file_ids: string[];
}

export interface GetFilesMetaResBody {
  files_meta: Record<string, FileMeta>;
}

export interface GetFilesResponseBody {
  files: Record<string, FilezFile>;
}

export interface GetStorageQuotaRequestBody {
  /** @format uuid */
  storage_location_id: string;
  /** @format uuid */
  subject_id: string;
  subject_type: AccessPolicySubjectType;
}

export interface GetUsersReqBody {
  user_ids: string[];
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

export interface ListAccessPoliciesRequestBody {
  /** @format int64 */
  from_index?: number | null;
  /** @format int64 */
  limit?: number | null;
  sort_by?: null | ListAccessPoliciesSortBy;
  sort_order?: null | SortDirection;
}

export interface ListAccessPoliciesResponseBody {
  access_policies: AccessPolicy[];
}

export interface ListFileGroupsRequestBody {
  /** @format int64 */
  from_index?: number | null;
  /** @format int64 */
  limit?: number | null;
  sort_by?: null | ListFileGroupsSortBy;
  sort_order?: null | SortDirection;
}

export interface ListFileGroupsResponseBody {
  file_groups: FileGroup[];
}

export interface ListFilesRequestBody {
  /** @format uuid */
  file_group_id: string;
  /** @format int64 */
  from_index?: number | null;
  /** @format int64 */
  limit?: number | null;
  sort?: null | ListFilesSorting;
}

export interface ListFilesResponseBody {
  files: FilezFile[];
  /** @format int64 */
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
  /** @format uuid */
  id: string;
  sort_order?: null | SortDirection;
}

export interface ListStorageLocationsRequestBody {
  sort_by?: null | ListStorageLocationsSortBy;
  sort_order?: null | SortDirection;
}

export interface ListStorageLocationsResponseBody {
  storage_locations: StorageLocationListItem[];
}

export interface ListStorageQuotasRequestBody {
  /** @format int64 */
  from_index?: number | null;
  /** @format int64 */
  limit?: number | null;
  sort_by?: null | ListStorageQuotasSortBy;
  sort_order?: null | SortDirection;
}

export interface ListUserGroupsRequestBody {
  /** @format int64 */
  from_index?: number | null;
  /** @format int64 */
  limit?: number | null;
  sort_by?: null | ListUserGroupsSortBy;
  sort_order?: null | SortDirection;
}

export interface ListUserGroupsResponseBody {
  user_groups: UserGroup[];
}

export interface ListUsersRequestBody {
  /** @format int64 */
  from_index?: number | null;
  /** @format int64 */
  limit?: number | null;
  sort_by?: string | null;
  sort_order?: null | SortDirection;
}

export interface ListUsersResponseBody {
  /** @format int64 */
  total_count: number;
  users: FilezUser[];
}

export interface ListedFilezUser {
  /** @format date-time */
  created_time: string;
  display_name: string;
  /** @format uuid */
  id: string;
}

export interface StorageLocationListItem {
  /** @format date-time */
  created_time: string;
  /** @format uuid */
  id: string;
  /** @format date-time */
  modified_time: string;
  name: string;
}

export interface StorageQuota {
  /** @format date-time */
  created_time: string;
  /** @format uuid */
  id: string;
  /** @format date-time */
  modified_time: string;
  name: string;
  /** @format uuid */
  owner_id: string;
  /** @format int64 */
  quota_bytes: number;
  /** @format uuid */
  storage_location_id: string;
  /** @format uuid */
  subject_id: string;
  subject_type: AccessPolicySubjectType;
}

export interface UpdateAccessPolicyRequestBody {
  actions: AccessPolicyAction[];
  /** @format uuid */
  context_app_id?: string | null;
  effect: AccessPolicyEffect;
  name: string;
  /** @format uuid */
  resource_id?: string | null;
  resource_type: AccessPolicyResourceType;
  /** @format uuid */
  subject_id: string;
  subject_type: AccessPolicySubjectType;
}

export interface UpdateFileGroupMembersRequestBody {
  /** @format uuid */
  file_group_id: string;
  files_to_add?: any[] | null;
  files_to_remove?: any[] | null;
}

export interface UpdateFileGroupRequestBody {
  name: string;
}

export interface UpdateFileRequestBody {
  /** @format uuid */
  file_id: string;
  file_name?: string | null;
  metadata?: null | FileMetadata;
  mime_type?: string | null;
}

export interface UpdateFileResponseBody {
  file: FilezFile;
}

export interface UpdateFileVersion {
  identifier: FileVersionIdentifier;
  new_metadata?: null | FileVersionMetadata;
}

export interface UpdateFileVersionsRequestBody {
  versions: UpdateFileVersion[];
}

export interface UpdateFileVersionsResponseBody {
  versions: FileVersion[];
}

export interface UpdateFilesMetaRequestBody {
  file_ids: string[];
  files_meta: UpdateFilesMetaType;
}

export type UpdateFilesMetaType = {
  Tags: UpdateFilesMetaTypeTags;
};

export interface UpdateFilesMetaTypeTags {
  method: UpdateFilesMetaTypeTagsMethod;
  tags: Record<string, string>;
}

export interface UpdateStorageQuotaRequestBody {
  /** @format int64 */
  quota_bytes: number;
  /** @format uuid */
  storage_location_id: string;
  /** @format uuid */
  subject_id: string;
  subject_type: AccessPolicySubjectType;
}

export interface UpdateUserGroupMembersRequestBody {
  /** @format uuid */
  user_group_id: string;
  users_to_add?: any[] | null;
  users_to_remove?: any[] | null;
}

export interface UpdateUserGroupRequestBody {
  name: string;
}

export interface UserGroup {
  /** @format date-time */
  created_time: string;
  /** @format uuid */
  id: string;
  /** @format date-time */
  modified_time: string;
  name: string;
  /** @format uuid */
  owner_id: string;
}

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
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  api = {
    /**
     * No description
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
     * No description
     *
     * @name CreateAccessPolicy
     * @request POST:/api/access_policies/create
     */
    createAccessPolicy: (
      data: CreateAccessPolicyRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseAccessPolicy, ApiResponseEmptyApiResponse>({
        path: `/api/access_policies/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name DeleteAccessPolicy
     * @request DELETE:/api/access_policies/delete/{access_policy_id}
     */
    deleteAccessPolicy: (accessPolicyId: string, params: RequestParams = {}) =>
      this.request<ApiResponseString, ApiResponseEmptyApiResponse>({
        path: `/api/access_policies/delete/${accessPolicyId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GetAccessPolicy
     * @request GET:/api/access_policies/get/{access_policy_id}
     */
    getAccessPolicy: (accessPolicyId: string, params: RequestParams = {}) =>
      this.request<ApiResponseAccessPolicy, ApiResponseEmptyApiResponse>({
        path: `/api/access_policies/get/${accessPolicyId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
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
     * No description
     *
     * @name UpdateAccessPolicy
     * @request PUT:/api/access_policies/update/{access_policy_id}
     */
    updateAccessPolicy: (
      accessPolicyId: string,
      data: UpdateAccessPolicyRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseAccessPolicy, ApiResponseEmptyApiResponse>({
        path: `/api/access_policies/update/${accessPolicyId}`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CreateFileGroup
     * @request POST:/api/file_groups/create
     */
    createFileGroup: (
      data: CreateFileGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseFileGroup, ApiResponseEmptyApiResponse>({
        path: `/api/file_groups/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name DeleteFileGroup
     * @request DELETE:/api/file_groups/delete/{file_group_id}
     */
    deleteFileGroup: (fileGroupId: string, params: RequestParams = {}) =>
      this.request<ApiResponseString, ApiResponseEmptyApiResponse>({
        path: `/api/file_groups/delete/${fileGroupId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GetFileGroup
     * @request GET:/api/file_groups/get/{file_group_id}
     */
    getFileGroup: (fileGroupId: string, params: RequestParams = {}) =>
      this.request<ApiResponseFileGroup, ApiResponseEmptyApiResponse>({
        path: `/api/file_groups/get/${fileGroupId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
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
     * No description
     *
     * @name ListFiles
     * @request POST:/api/file_groups/list_files
     */
    listFiles: (data: ListFilesRequestBody, params: RequestParams = {}) =>
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
     * No description
     *
     * @name UpdateFileGroup
     * @request PUT:/api/file_groups/update/{file_group_id}
     */
    updateFileGroup: (
      fileGroupId: string,
      data: UpdateFileGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseFileGroup, ApiResponseEmptyApiResponse>({
        path: `/api/file_groups/update/${fileGroupId}`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
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
     * No description
     *
     * @name GetFileVersionContent
     * @request GET:/api/file_versions/content/get/{file_id}/{version}/{app_id}/{app_path}
     */
    getFileVersionContent: (
      fileId: string,
      version: number | null,
      appId: string | null,
      appPath: string | null,
      d: boolean | null,
      c: number | null,
      params: RequestParams = {},
    ) =>
      this.request<number[], ApiResponseEmptyApiResponse>({
        path: `/api/file_versions/content/get/${fileId}/${version}/${appId}/${appPath}`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @name FileVersionsContentTusHead
     * @request HEAD:/api/file_versions/content/tus/{file_id}/{version}
     */
    fileVersionsContentTusHead: (
      fileId: string,
      version: number | null,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/file_versions/content/tus/${fileId}/${version}`,
        method: "HEAD",
        ...params,
      }),

    /**
     * @description Patch a file version using the TUS protocol. The file and the file version must exist. If the file version is marked as verified it cannot be patched, unless the expected checksum is updated or removed.
     *
     * @tags FileVersion
     * @name FileVersionsContentTusPatch
     * @request PATCH:/api/file_versions/content/tus/{file_id}/{version}
     */
    fileVersionsContentTusPatch: (
      fileId: string,
      version: number | null,
      data: any,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/file_versions/content/tus/${fileId}/${version}`,
        method: "PATCH",
        body: data,
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
     * @request POST:/api/file_versions/delete
     */
    deleteFileVersions: (
      data: DeleteFileVersionsRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<
        ApiResponseDeleteFileVersionsResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/file_versions/delete`,
        method: "POST",
        body: data,
        type: ContentType.Json,
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
     * @description Update file versions in the database
     *
     * @name UpdateFileVersions
     * @request POST:/api/file_versions/update
     */
    updateFileVersions: (
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
      this.request<ApiResponseCreateFileResponseBody, any>({
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
     * @request POST:/api/files/delete
     */
    deleteFile: (data: DeleteFileRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseDeleteFileResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/files/delete`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get files from the server
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
     * No description
     *
     * @name GetFilesMetadata
     * @request POST:/api/files/meta/get
     */
    getFilesMetadata: (
      data: GetFilesMetaRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseGetFilesMetaResBody, ApiResponseEmptyApiResponse>(
        {
          path: `/api/files/meta/get`,
          method: "POST",
          body: data,
          type: ContentType.Json,
          format: "json",
          ...params,
        },
      ),

    /**
     * No description
     *
     * @name UpdateFilesMetadata
     * @request PUT:/api/files/meta/update
     */
    updateFilesMetadata: (
      data: UpdateFilesMetaRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/files/meta/update`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update a file entry in the database
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
     * No description
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
     * No description
     *
     * @name ListStorageLocations
     * @request POST:/api/storage_locations/list
     */
    listStorageLocations: (
      data: ListStorageLocationsRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseListStorageLocationsResponseBody, any>({
        path: `/api/storage_locations/list`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
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
     * No description
     *
     * @name DeleteStorageQuota
     * @request DELETE:/api/storage_quotas/delete
     */
    deleteStorageQuota: (
      data: DeleteStorageQuotaRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseEmptyApiResponse, ApiResponseEmptyApiResponse>({
        path: `/api/storage_quotas/delete`,
        method: "DELETE",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GetStorageQuota
     * @request GET:/api/storage_quotas/get
     */
    getStorageQuota: (
      data: GetStorageQuotaRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseStorageQuota, ApiResponseEmptyApiResponse>({
        path: `/api/storage_quotas/get`,
        method: "GET",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ListStorageQuotas
     * @request POST:/api/storage_quotas/list
     */
    listStorageQuotas: (
      data: ListStorageQuotasRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseVecStorageQuota, ApiResponseEmptyApiResponse>({
        path: `/api/storage_quotas/list`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UpdateStorageQuota
     * @request PUT:/api/storage_quotas/update
     */
    updateStorageQuota: (
      data: UpdateStorageQuotaRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseStorageQuota, ApiResponseEmptyApiResponse>({
        path: `/api/storage_quotas/update`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CreateUserGroup
     * @request POST:/api/user_groups/create
     */
    createUserGroup: (
      data: CreateUserGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseUserGroup, ApiResponseEmptyApiResponse>({
        path: `/api/user_groups/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
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
     * No description
     *
     * @name GetUserGroup
     * @request GET:/api/user_groups/get/{user_group_id}
     */
    getUserGroup: (userGroupId: string, params: RequestParams = {}) =>
      this.request<ApiResponseUserGroup, ApiResponseEmptyApiResponse>({
        path: `/api/user_groups/get/${userGroupId}`,
        method: "GET",
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
     * No description
     *
     * @name ListUsersByUserGroup
     * @request POST:/api/user_groups/list_users/{user_group_id}
     */
    listUsersByUserGroup: (
      userGroupId: string,
      data: ListUsersRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseListUsersResponseBody, any>({
        path: `/api/user_groups/list_users/${userGroupId}`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
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
     * No description
     *
     * @name UpdateUserGroup
     * @request PUT:/api/user_groups/{user_group_id}
     */
    updateUserGroup: (
      userGroupId: string,
      data: UpdateUserGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseUserGroup, ApiResponseEmptyApiResponse>({
        path: `/api/user_groups/${userGroupId}`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ApplyUser
     * @request POST:/api/users/apply
     */
    applyUser: (params: RequestParams = {}) =>
      this.request<
        ApiResponseApplyUserResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/users/apply`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
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
     * No description
     *
     * @name DeleteUser
     * @request POST:/api/users/delete
     */
    deleteUser: (data: DeleteUserRequestBody, params: RequestParams = {}) =>
      this.request<
        ApiResponseDeleteUserResponseBody,
        ApiResponseEmptyApiResponse
      >({
        path: `/api/users/delete`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
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
     * No description
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
