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

export enum ListUserGroupsSortBy {
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
}

export enum AccessPolicyResourceType {
  File = "file",
  FileGroup = "file_group",
  User = "user",
  UserGroup = "user_group",
  StorageLocation = "storage_location",
  AccessPolicy = "access_policy",
}

export enum AccessPolicyEffect {
  Deny = "Deny",
  Allow = "Allow",
}

export enum AccessPolicyAction {
  FilezFilesVersionsContentGet = "filez.files.versions.content.get",
  FilezFilesVersionsContentTusHead = "filez.files.versions.content.tus.head",
  FilezFilesVersionsContentTusPatch = "filez.files.versions.content.tus.patch",
  FilezFilesCreate = "filez.files.create",
  FilezFilesMetaGet = "filez.files.meta.get",
  FilezFilesMetaList = "filez.files.meta.list",
  FilezFilesMetaUpdate = "filez.files.meta.update",
  FilezUsersGet = "filez.users.get",
  FilezFileGroupsCreate = "filez.file_groups.create",
  FilezFileGroupsRead = "filez.file_groups.read",
  FilezFileGroupsUpdate = "filez.file_groups.update",
  FilezFileGroupsDelete = "filez.file_groups.delete",
  FilezFileGroupsList = "filez.file_groups.list",
  FilezFileGroupsListFiles = "filez.file_groups.list_files",
  FilezUserGroupsCreate = "filez.user_groups.create",
  FilezUserGroupsRead = "filez.user_groups.read",
  FilezUserGroupsUpdate = "filez.user_groups.update",
  FilezUserGroupsDelete = "filez.user_groups.delete",
  FilezUserGroupsList = "filez.user_groups.list",
  FilezUserGroupsListUsers = "filez.user_groups.list_users",
  FilezAccessPoliciesCreate = "filez.access_policies.create",
  FilezAccessPoliciesRead = "filez.access_policies.read",
  FilezAccessPoliciesUpdate = "filez.access_policies.update",
  FilezAccessPoliciesDelete = "filez.access_policies.delete",
  FilezAccessPoliciesList = "filez.access_policies.list",
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
    /** @format uuid */
    user_id: string;
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
    file_id: string;
  };
  message: string;
  status: ApiResponseStatus;
}

export interface ApiResponseCreateFileVersionResponseBody {
  data?: {
    /** @format int32 */
    version: number;
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

export interface ApiResponseGetFileMetaResBody {
  data?: {
    files_meta: Record<string, FileMeta>;
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
  data?: object;
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

export interface ApiResponseString {
  data?: string;
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

export interface ApplyUserResponseBody {
  /** @format uuid */
  user_id: string;
}

export interface AuthEvaluation {
  is_allowed: boolean;
  reason: AuthReason;
  /** @format uuid */
  resource_id?: string | null;
}

export type AuthReason =
  | "Owned"
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
  action: string;
  requesting_app_origin?: string | null;
  resource_ids?: any[] | null;
  resource_type: string;
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
  file_id: string;
}

export interface CreateFileVersionRequestBody {
  app_path?: string | null;
  /** @format uuid */
  file_id: string;
  metadata: FileVersionMetadata;
  /** @format int64 */
  size: number;
  /** @format uuid */
  storage_id: string;
}

export interface CreateFileVersionResponseBody {
  /** @format int32 */
  version: number;
}

export interface CreateUserGroupRequestBody {
  name: string;
}

/** @default null */
export type EmptyApiResponse = any;

export interface FileGroup {
  /** @format date-time */
  created_time: string;
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
  /** @format date-time */
  created_time: string;
  deleted: boolean;
  display_name: string;
  external_user_id?: string | null;
  /** @format uuid */
  id: string;
  /** @format date-time */
  modified_time: string;
}

export interface GetFileMetaResBody {
  files_meta: Record<string, FileMeta>;
}

export interface GetFilesMetaRequestBody {
  file_ids: string[];
}

export interface GetUsersReqBody {
  user_ids: string[];
}

export interface GetUsersResBody {
  users_meta: Record<string, UserMeta>;
}

export type HealthResBody = object;

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

export interface UpdateFileGroupRequestBody {
  name: string;
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
 * @title server
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
     * @name CreateAccessPolicy
     * @request POST:/api/access_policies
     */
    createAccessPolicy: (
      data: CreateAccessPolicyRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseAccessPolicy, any>({
        path: `/api/access_policies`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

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
      this.request<ApiResponseCheckResourceAccessResponseBody, any>({
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
     * @name ListAccessPolicies
     * @request POST:/api/access_policies/list
     */
    listAccessPolicies: (
      data: ListAccessPoliciesRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseListAccessPoliciesResponseBody, any>({
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
     * @name GetAccessPolicy
     * @request GET:/api/access_policies/{access_policy_id}
     */
    getAccessPolicy: (accessPolicyId: string, params: RequestParams = {}) =>
      this.request<ApiResponseAccessPolicy, any>({
        path: `/api/access_policies/${accessPolicyId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UpdateAccessPolicy
     * @request PUT:/api/access_policies/{access_policy_id}
     */
    updateAccessPolicy: (
      accessPolicyId: string,
      data: UpdateAccessPolicyRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseAccessPolicy, any>({
        path: `/api/access_policies/${accessPolicyId}`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name DeleteAccessPolicy
     * @request DELETE:/api/access_policies/{access_policy_id}
     */
    deleteAccessPolicy: (accessPolicyId: string, params: RequestParams = {}) =>
      this.request<ApiResponseString, any>({
        path: `/api/access_policies/${accessPolicyId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CreateFileGroup
     * @request POST:/api/file_groups
     */
    createFileGroup: (
      data: CreateFileGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseFileGroup, any>({
        path: `/api/file_groups`,
        method: "POST",
        body: data,
        type: ContentType.Json,
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
      this.request<ApiResponseListFileGroupsResponseBody, any>({
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
      this.request<ApiResponseListFilesResponseBody, any>({
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
     * @name GetFileGroup
     * @request GET:/api/file_groups/{file_group_id}
     */
    getFileGroup: (fileGroupId: string, params: RequestParams = {}) =>
      this.request<ApiResponseFileGroup, any>({
        path: `/api/file_groups/${fileGroupId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UpdateFileGroup
     * @request PUT:/api/file_groups/{file_group_id}
     */
    updateFileGroup: (
      fileGroupId: string,
      data: UpdateFileGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseFileGroup, any>({
        path: `/api/file_groups/${fileGroupId}`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name DeleteFileGroup
     * @request DELETE:/api/file_groups/{file_group_id}
     */
    deleteFileGroup: (fileGroupId: string, params: RequestParams = {}) =>
      this.request<ApiResponseString, any>({
        path: `/api/file_groups/${fileGroupId}`,
        method: "DELETE",
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
     * No description
     *
     * @name GetFilesMetadata
     * @request POST:/api/files/meta/get
     */
    getFilesMetadata: (
      data: GetFilesMetaRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseGetFileMetaResBody, any>({
        path: `/api/files/meta/get`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

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
      this.request<ApiResponseEmptyApiResponse, any>({
        path: `/api/files/meta/update`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new file version entry in the database
     *
     * @name CreateFileVersion
     * @request POST:/api/files/versions/create/
     */
    createFileVersion: (
      data: CreateFileVersionRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseCreateFileVersionResponseBody, any>({
        path: `/api/files/versions/create/`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GetFileContent
     * @request GET:/api/files/versions/get/content/{file_id}/{version}/{app_id}/{app_path}
     */
    getFileContent: (
      fileId: string,
      version: number | null,
      appId: string | null,
      appPath: string | null,
      d: boolean | null,
      c: number | null,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/files/versions/get/content/${fileId}/${version}/${appId}/${appPath}`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @name TusHead
     * @request HEAD:/api/files/versions/tus/head/{file_id}/{version}/{job_id}
     */
    tusHead: (
      fileId: string,
      version: number | null,
      jobId: string,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/files/versions/tus/head/${fileId}/${version}/${jobId}`,
        method: "HEAD",
        ...params,
      }),

    /**
     * No description
     *
     * @name TusPatch
     * @request PATCH:/api/files/versions/tus/patch/{file_id}/{version}
     */
    tusPatch: (
      fileId: string,
      version: number | null,
      data: any,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/files/versions/tus/patch/${fileId}/${version}`,
        method: "PATCH",
        body: data,
        ...params,
      }),

    /**
     * No description
     *
     * @name GetHealth
     * @request GET:/api/health
     */
    getHealth: (params: RequestParams = {}) =>
      this.request<ApiResponseHealthResBody, any>({
        path: `/api/health`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CreateUserGroup
     * @request POST:/api/user_groups
     */
    createUserGroup: (
      data: CreateUserGroupRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseUserGroup, any>({
        path: `/api/user_groups`,
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
      this.request<ApiResponseListUserGroupsResponseBody, any>({
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
     * @name GetUserGroup
     * @request GET:/api/user_groups/{user_group_id}
     */
    getUserGroup: (userGroupId: string, params: RequestParams = {}) =>
      this.request<ApiResponseUserGroup, any>({
        path: `/api/user_groups/${userGroupId}`,
        method: "GET",
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
      this.request<ApiResponseUserGroup, any>({
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
     * @name DeleteUserGroup
     * @request DELETE:/api/user_groups/{user_group_id}
     */
    deleteUserGroup: (userGroupId: string, params: RequestParams = {}) =>
      this.request<ApiResponseString, any>({
        path: `/api/user_groups/${userGroupId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ListUsers
     * @request POST:/api/user_groups/{user_group_id}/list_users
     */
    listUsers: (
      userGroupId: string,
      data: ListUsersRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseListUsersResponseBody, any>({
        path: `/api/user_groups/${userGroupId}/list_users`,
        method: "POST",
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
      this.request<ApiResponseApplyUserResponseBody, any>({
        path: `/api/users/apply`,
        method: "POST",
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
      this.request<ApiResponseGetUsersResBody, any>({
        path: `/api/users/get`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
}
