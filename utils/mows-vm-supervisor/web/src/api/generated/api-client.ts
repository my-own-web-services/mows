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

/**
 * VM lifecycle status as exposed over the API. Mirrors the SQL CHECK
 * constraint in `migrations/0001_init.sql`. Serialised as the
 * lowercase variant name so the wire format stays
 * `"starting"|"running"|…` and the TypeScript codegen emits a union
 * literal instead of a bare `string` (FUTURE-14).
 */
export enum VmStatus {
  Starting = "starting",
  Running = "running",
  Stopping = "stopping",
  Stopped = "stopped",
  Failed = "failed",
}

/**
 * Guest base image. Only `alpine` is currently shipped end-to-end — the
 * other variants are accepted by the API surface but `create_vm` will
 * reject them with a 503 until the image-builder lands the qcow2.
 */
export enum VmImage {
  Alpine = "alpine",
  Ubuntu = "ubuntu",
  Debian = "debian",
  Nixos = "nixos",
}

/**
 * `headless`: SSH only, no graphical surface inside the guest.
 * `desktop`: image starts a graphical session; the supervisor's VNC
 * websocket exposes it.
 */
export enum VmDisplayMode {
  Headless = "headless",
  Desktop = "desktop",
}

/**
 * Wire-level agent kind. Mapped to a builtin manifest by
 * [`AgentKindName::to_kind`]. Adding a value here lights up serde's
 * validation (unknown variants → 400 with a descriptive error before the
 * handler runs), eliminates the stringly-typed match in `spawn_agent`,
 * and gives the TypeScript codegen a real union literal.
 */
export enum AgentKindName {
  Shell = "shell",
  Claude = "claude",
}

export interface AgentSummary {
  /** @format int64 */
  exit_code?: number | null;
  exited_at?: string | null;
  id: string;
  kind: string;
  name: string;
  /**
   * `users.id` of the caller who created the agent. `None` for legacy
   * rows written before owner tracking was plumbed; admins can still
   * see them, non-admin users cannot.
   */
  owner_user_id?: string | null;
  started_at: string;
  status: string;
  vm_id: string;
}

export interface CreateAgentRequest {
  /**
   * Agent kind. Omit (or pass `null`) to fall back to the built-in
   * `shell` kind — a plain `/bin/sh` session. Unknown variants are
   * rejected by serde before the handler runs (400 Bad Request).
   */
  kind?: null | AgentKindName;
  /** Display name. Auto-generated from `kind` + UTC timestamp when omitted. */
  name?: string | null;
}

export interface CreateUserRequest {
  password: string;
  role?: string;
  username: string;
}

export interface CreateVmRequest {
  /**
   * @format int32
   * @min 0
   */
  cpus?: number | null;
  cwd?: string | null;
  /**
   * Whether the guest exposes a graphical surface. Defaults to
   * `headless` when omitted; the default is logged at `INFO` level
   * for the same reason as `image`.
   */
  display_mode?: null | VmDisplayMode;
  /**
   * Guest base image. Defaults to `alpine` when omitted, but the
   * default is logged at `INFO` level so silently-defaulted requests
   * don't hide misspelled image names (SLOP-36). Pass an explicit
   * value (`alpine` | `ubuntu` | `debian` | `nixos`) to record intent.
   */
  image?: null | VmImage;
  /**
   * @format int32
   * @min 0
   */
  memory_mb?: number | null;
  name?: string | null;
}

/**
 * Error body returned from every fallible endpoint. Matches
 * `SupervisorError::into_response` in `crate::error`.
 */
export interface ErrorResponse {
  /** Public, user-safe error description. */
  error: string;
}

export interface HealthResponse {
  service: string;
  status: string;
  version: string;
}

export interface LoginRequest {
  password: string;
  username: string;
}

export interface LoginResponse {
  /** @format date-time */
  expires_at: string;
  token: string;
}

/** Response body for a successful lifecycle mutation on a VM or agent. */
export interface OperationResult {
  /** `true` if the resource was deleted. */
  deleted?: boolean | null;
  /** Id of the affected resource. */
  id: string;
  /** New status, if the operation transitions one (e.g. "stopped"). */
  status?: string | null;
}

export interface UpdateAgentRequest {
  /** New display name. Must be non-empty. */
  name: string;
}

export interface UpdateVmRequest {
  /** New display name. Must be non-empty. */
  name: string;
}

export interface UserSummary {
  created_at: string;
  id: string;
  role: string;
  username: string;
}

export interface VmDefaultsResponse {
  /**
   * @format int32
   * @min 0
   */
  cpus: number;
  /**
   * @format int32
   * @min 0
   */
  memory_mb: number;
}

export interface VmSshInfo {
  host: string;
  /** @format int64 */
  port: number;
  private_key: string;
  public_key: string;
  user: string;
}

export interface VmSummary {
  /** @format int64 */
  cpus?: number | null;
  cwd?: string | null;
  /**
   * `headless`: SSH only, no graphical surface inside the guest.
   * `desktop`: image starts a graphical session; the supervisor's VNC
   * websocket exposes it.
   */
  display_mode: VmDisplayMode;
  /** @format int64 */
  exit_code?: number | null;
  exited_at?: string | null;
  /** @format int64 */
  host_docker_port?: number | null;
  /** @format int64 */
  host_ssh_port?: number | null;
  id: string;
  /**
   * Guest base image. Only `alpine` is currently shipped end-to-end — the
   * other variants are accepted by the API surface but `create_vm` will
   * reject them with a 503 until the image-builder lands the qcow2.
   */
  image: VmImage;
  /** @format int64 */
  memory_mb?: number | null;
  name: string;
  /**
   * `users.id` of the caller who created the VM. `None` for legacy
   * rows written before owner tracking landed (admins still see
   * them; non-admin users do not).
   */
  owner_user_id?: string | null;
  started_at: string;
  /**
   * VM lifecycle status as exposed over the API. Mirrors the SQL CHECK
   * constraint in `migrations/0001_init.sql`. Serialised as the
   * lowercase variant name so the wire format stays
   * `"starting"|"running"|…` and the TypeScript codegen emits a union
   * literal instead of a bare `string` (FUTURE-14).
   */
  status: VmStatus;
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
 * @title mows-vm-supervisor
 * @version 0.1.0
 * @license
 *
 * REST API for mows-vm-supervisor.
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  v1 = {
    /**
     * @description List agents the caller can see (own agents only for non-admin users).
     *
     * @tags agents
     * @name ListAllAgents
     * @request GET:/v1/agents
     */
    listAllAgents: (params: RequestParams = {}) =>
      this.request<AgentSummary[], ErrorResponse>({
        path: `/v1/agents`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Fetch a single agent by id.
     *
     * @tags agents
     * @name GetAgent
     * @request GET:/v1/agents/{id}
     */
    getAgent: (id: string, params: RequestParams = {}) =>
      this.request<AgentSummary, ErrorResponse>({
        path: `/v1/agents/${id}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Delete an agent and its on-disk state. The VM stays running.
     *
     * @tags agents
     * @name DeleteAgent
     * @request DELETE:/v1/agents/{id}
     */
    deleteAgent: (id: string, params: RequestParams = {}) =>
      this.request<OperationResult, ErrorResponse>({
        path: `/v1/agents/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * @description Update mutable fields of an agent (currently just `name`).
     *
     * @tags agents
     * @name UpdateAgent
     * @request PATCH:/v1/agents/{id}
     */
    updateAgent: (
      id: string,
      data: UpdateAgentRequest,
      params: RequestParams = {},
    ) =>
      this.request<AgentSummary, ErrorResponse>({
        path: `/v1/agents/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Stop a running agent. The VM hosting it stays up.
     *
     * @tags agents
     * @name StopAgent
     * @request POST:/v1/agents/{id}/stop
     */
    stopAgent: (id: string, params: RequestParams = {}) =>
      this.request<OperationResult, ErrorResponse>({
        path: `/v1/agents/${id}/stop`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * @description Exchange username + password for an opaque bearer token. The token is good for 30 days.
     *
     * @tags auth
     * @name Login
     * @request POST:/v1/auth/login
     */
    login: (data: LoginRequest, params: RequestParams = {}) =>
      this.request<LoginResponse, ErrorResponse>({
        path: `/v1/auth/login`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Liveness probe. Always 200 if the process is up.
     *
     * @tags health
     * @name Healthz
     * @request GET:/v1/healthz
     */
    healthz: (params: RequestParams = {}) =>
      this.request<HealthResponse, any>({
        path: `/v1/healthz`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description List every supervisor user, sorted by username.
     *
     * @tags users
     * @name ListUsers
     * @request GET:/v1/users
     */
    listUsers: (params: RequestParams = {}) =>
      this.request<UserSummary[], any>({
        path: `/v1/users`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new supervisor user.
     *
     * @tags users
     * @name CreateUser
     * @request POST:/v1/users
     */
    createUser: (data: CreateUserRequest, params: RequestParams = {}) =>
      this.request<UserSummary, ErrorResponse>({
        path: `/v1/users`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description List every VM, newest first.
     *
     * @tags vms
     * @name ListVms
     * @request GET:/v1/vms
     */
    listVms: (params: RequestParams = {}) =>
      this.request<VmSummary[], ErrorResponse>({
        path: `/v1/vms`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Spawn a new VM. Returns once QEMU is launched; the VM is then reachable via the SSH probe (status flips to `running` when ready).
     *
     * @tags vms
     * @name CreateVm
     * @request POST:/v1/vms
     */
    createVm: (data: CreateVmRequest, params: RequestParams = {}) =>
      this.request<VmSummary, ErrorResponse>({
        path: `/v1/vms`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Server-side defaults applied when a `create_vm` request omits the corresponding field.
     *
     * @tags vms
     * @name GetVmDefaults
     * @request GET:/v1/vms/defaults
     */
    getVmDefaults: (params: RequestParams = {}) =>
      this.request<VmDefaultsResponse, any>({
        path: `/v1/vms/defaults`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Fetch a single VM by id.
     *
     * @tags vms
     * @name GetVm
     * @request GET:/v1/vms/{id}
     */
    getVm: (id: string, params: RequestParams = {}) =>
      this.request<VmSummary, ErrorResponse>({
        path: `/v1/vms/${id}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a VM and every on-disk artefact tied to it. Irreversible.
     *
     * @tags vms
     * @name DeleteVm
     * @request DELETE:/v1/vms/{id}
     */
    deleteVm: (id: string, params: RequestParams = {}) =>
      this.request<OperationResult, ErrorResponse>({
        path: `/v1/vms/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * @description Update mutable fields of a VM (currently just `name`).
     *
     * @tags vms
     * @name UpdateVm
     * @request PATCH:/v1/vms/{id}
     */
    updateVm: (id: string, data: UpdateVmRequest, params: RequestParams = {}) =>
      this.request<VmSummary, ErrorResponse>({
        path: `/v1/vms/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Return host/port + the supervisor's host keypair so the caller can ssh in.
     *
     * @tags vms
     * @name GetVmSsh
     * @request GET:/v1/vms/{id}/ssh
     */
    getVmSsh: (id: string, params: RequestParams = {}) =>
      this.request<VmSshInfo, ErrorResponse>({
        path: `/v1/vms/${id}/ssh`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Stop a running VM. Reaps all agents the VM was hosting.
     *
     * @tags vms
     * @name StopVm
     * @request POST:/v1/vms/{id}/stop
     */
    stopVm: (id: string, params: RequestParams = {}) =>
      this.request<OperationResult, ErrorResponse>({
        path: `/v1/vms/${id}/stop`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * @description List agents inside a single VM that the caller is allowed to see.
     *
     * @tags agents
     * @name ListVmAgents
     * @request GET:/v1/vms/{vm_id}/agents
     */
    listVmAgents: (vmId: string, params: RequestParams = {}) =>
      this.request<AgentSummary[], ErrorResponse>({
        path: `/v1/vms/${vmId}/agents`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Spawn an agent inside a running VM. The server picks the agent id.
     *
     * @tags agents
     * @name CreateAgent
     * @request POST:/v1/vms/{vm_id}/agents
     */
    createAgent: (
      vmId: string,
      data: CreateAgentRequest,
      params: RequestParams = {},
    ) =>
      this.request<AgentSummary, ErrorResponse>({
        path: `/v1/vms/${vmId}/agents`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create-or-return an agent with the caller-supplied id. Used by the web UI's ConsoleManager so a tab's persisted id round-trips to a single agent row across reloads. If the agent already exists, its `vm_id`, `kind`, and owner MUST match the request, otherwise 409 — preventing silent cross-VM or cross-tenant reattachment.
     *
     * @tags agents
     * @name PutAgent
     * @request PUT:/v1/vms/{vm_id}/agents/{agent_id}
     */
    putAgent: (
      vmId: string,
      agentId: string,
      data: CreateAgentRequest,
      params: RequestParams = {},
    ) =>
      this.request<AgentSummary, ErrorResponse>({
        path: `/v1/vms/${vmId}/agents/${agentId}`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
}
