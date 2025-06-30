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

export enum SortOrder {
  Ascending = "Ascending",
  Descending = "Descending",
}

export enum ApiResponseStatus {
  Success = "Success",
  Error = "Error",
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

export interface ApiResponseEmptyApiResponse {
  /** @default null */
  data?: any;
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

export interface ApiResponseListFilesResponseBody {
  data?: {
    files: File[];
    /** @format int64 */
    total_count: number;
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
  resource_id: string;
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
  resource_ids: string[];
  resource_type: string;
}

export interface CheckResourceAccessResponseBody {
  auth_evaluations: AuthEvaluation[];
}

export interface CreateFileRequestBody {
  file_name: string;
  mime_type?: string | null;
  sha256_digest?: string | null;
  /** @format date-time */
  time_created?: string | null;
  /** @format date-time */
  time_modified?: string | null;
}

export interface CreateFileResponseBody {
  file_id: string;
}

/** @default null */
export type EmptyApiResponse = any;

export interface File {
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
  sha256_digest?: string | null;
  /** @format int64 */
  size: number;
  storage: StorageLocation;
}

export interface FileMeta {
  file: File;
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

export interface ListFilesRequestBody {
  /** @format uuid */
  file_group_id: string;
  /** @format int64 */
  from_index?: number | null;
  /** @format int64 */
  limit?: number | null;
  sort_by?: string | null;
  sort_order?: null | SortOrder;
}

export interface ListFilesResponseBody {
  files: File[];
  /** @format int64 */
  total_count: number;
}

export interface StorageLocation {
  /** app_id -> provider_id */
  locations: Record<string, string>;
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

export interface User {
  /** @format date-time */
  created_time: string;
  deleted: boolean;
  display_name: string;
  external_user_id?: string | null;
  /** @format uuid */
  id: string;
  /** @format date-time */
  modified_time: string;
  /** @format int64 */
  storage_limit: number;
}

export interface UserMeta {
  user: User;
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
     * @name CheckResourceAccess
     * @request POST:/api/auth/check
     */
    checkResourceAccess: (
      data: CheckResourceAccessRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseCheckResourceAccessResponseBody, any>({
        path: `/api/auth/check`,
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
     * @name GetFileContent
     * @request GET:/api/files/content/get/{file_id}/{app_id}/{app_path}
     */
    getFileContent: (
      fileId: string,
      appId: string | null,
      appPath: string | null,
      d: boolean | null,
      c: number | null,
      params: RequestParams = {},
    ) =>
      this.request<void, void>({
        path: `/api/files/content/get/${fileId}/${appId}/${appPath}`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @name CreateFile
     * @request POST:/api/files/create
     */
    createFile: (data: any, params: RequestParams = {}) =>
      this.request<ApiResponseCreateFileResponseBody, any>({
        path: `/api/files/create`,
        method: "POST",
        body: data,
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
     * @request POST:/api/files/meta/update
     */
    updateFilesMetadata: (
      data: UpdateFilesMetaRequestBody,
      params: RequestParams = {},
    ) =>
      this.request<ApiResponseEmptyApiResponse, any>({
        path: `/api/files/meta/update`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name TusHead
     * @request HEAD:/api/files/tus/head/{file_id}
     */
    tusHead: (fileId: string, params: RequestParams = {}) =>
      this.request<void, void>({
        path: `/api/files/tus/head/${fileId}`,
        method: "HEAD",
        ...params,
      }),

    /**
     * No description
     *
     * @name TusPatch
     * @request PATCH:/api/files/tus/patch/{file_id}
     */
    tusPatch: (fileId: string, data: any, params: RequestParams = {}) =>
      this.request<void, void>({
        path: `/api/files/tus/patch/${fileId}`,
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
