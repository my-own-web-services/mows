/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface BackupNode {
  backup_wg_private_key?: string | null;
  hostname: string;
  mac: string;
  machine_id: string;
  ssh: SshAccess;
}

export interface Cluster {
  backup_nodes: Record<string, BackupNode>;
  cluster_backup_wg_private_key?: string | null;
  cluster_nodes: Record<string, ClusterNode>;
  encryption_key?: string | null;
  id: string;
  install_state?: ClusterInstallState | null;
  k3s_token: string;
  kubeconfig?: string | null;
  public_ip_config?: PublicIpConfig | null;
}

export type ClusterCreationConfig = object;

export enum ClusterInstallState {
  Kubernetes = "Kubernetes",
  BasicsConfigured = "BasicsConfigured",
  BasicsReady = "BasicsReady",
}

export interface ClusterNode {
  hostname: string;
  machine_id: string;
  ssh: SshAccess;
}

export interface ExternalHetznerConfig {
  server_type: string;
}

export type ExternalProviderIpOptions =
  | {
      Hetzner: ExternalProviderIpOptionsHetzner;
    }
  | "Own";

export interface ExternalProviderIpOptionsHetzner {
  server_id: string;
  ssh_access?: SshAccess | null;
}

export interface ExternalProviders {
  hetzner?: ExternalProvidersHetzner | null;
}

export interface ExternalProvidersHetzner {
  api_token: string;
}

export interface LocalQemuConfig {
  /**
   * @format int32
   * @min 0
   */
  cpus: number;
  /**
   * * Memory in GB
   * @format int32
   * @min 0
   */
  memory: number;
}

export interface Machine {
  id: string;
  install?: null;
  mac?: string | null;
  machine_type: MachineType;
}

export type MachineCreationReqBody =
  | {
      LocalQemu: LocalQemuConfig;
    }
  | {
      Local: string[];
    }
  | {
      ExternalHetzner: ExternalHetznerConfig;
    };

export interface MachineDeleteReqBody {
  machine_id: string;
}

export interface MachineInfoReqBody {
  machine_id: string;
}

export interface MachineInfoResBody {
  machine_infos: any;
}

export enum MachineInstallState {
  Configured = "Configured",
  Requested = "Requested",
  Installed = "Installed",
}

export enum MachineSignal {
  Start = "Start",
  Reboot = "Reboot",
  Shutdown = "Shutdown",
  Reset = "Reset",
  ForceOff = "ForceOff",
}

export interface MachineSignalReqBody {
  machine_id: string;
  signal: MachineSignal;
}

export interface MachineStatus {
  id: string;
  status: string;
}

export enum MachineType {
  LocalQemu = "LocalQemu",
  Local = "Local",
  ExternalHetzner = "ExternalHetzner",
}

export interface ManagerConfig {
  clusters: Record<string, Cluster>;
  external_providers: ExternalProviders;
  machines: Record<string, Machine>;
}

export interface PixiecoreBootConfig {
  cmdline: string;
  initrd: string[];
  kernel: string;
}

export interface PublicIpConfig {
  ips: Record<string, PublicIpConfigSingleIp>;
}

export interface PublicIpConfigSingleIp {
  ip: any;
  provider: ExternalProviderIpOptions;
}

export interface SshAccess {
  remote_public_key?: string | null;
  ssh_passphrase: string;
  ssh_password: string;
  ssh_private_key: string;
  ssh_public_key: string;
  ssh_username: string;
}

export interface Success {
  message: string;
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

export type RequestParams = Omit<FullRequestParams, "body" | "method" | "query" | "path">;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (securityData: SecurityDataType | null) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown> extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) => fetch(...fetchParams);

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
    const keys = Object.keys(query).filter((key) => "undefined" !== typeof query[key]);
    return keys
      .map((key) => (Array.isArray(query[key]) ? this.addArrayQueryParam(query, key) : this.addQueryParam(query, key)))
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string") ? JSON.stringify(input) : input,
    [ContentType.Text]: (input: any) => (input !== null && typeof input !== "string" ? JSON.stringify(input) : input),
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

  protected mergeRequestParams(params1: RequestParams, params2?: RequestParams): RequestParams {
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

  protected createAbortSignal = (cancelToken: CancelToken): AbortSignal | undefined => {
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

    return this.customFetch(`${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`, {
      ...requestParams,
      headers: {
        ...(requestParams.headers || {}),
        ...(type && type !== ContentType.FormData ? { "Content-Type": type } : {}),
      },
      signal: (cancelToken ? this.createAbortSignal(cancelToken) : requestParams.signal) || null,
      body: typeof body === "undefined" || body === null ? null : payloadFormatter(body),
    }).then(async (response) => {
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
 * @title manager
 * @version 0.1.0
 * @license
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  api = {
    /**
     * No description
     *
     * @tags crate
     * @name GetConfig
     * @request GET:/api/config
     */
    getConfig: (params: RequestParams = {}) =>
      this.request<any, ManagerConfig>({
        path: `/api/config`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name UpdateConfig
     * @request PUT:/api/config
     */
    updateConfig: (data: ManagerConfig, params: RequestParams = {}) =>
      this.request<Success, string>({
        path: `/api/config`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name DevCreateClusterFromAllMachinesInInventory
     * @request POST:/api/dev/cluster/create_from_all_machines_in_inventory
     */
    devCreateClusterFromAllMachinesInInventory: (data: ClusterCreationConfig, params: RequestParams = {}) =>
      this.request<Success, string>({
        path: `/api/dev/cluster/create_from_all_machines_in_inventory`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name DevInstallClusterBasics
     * @request POST:/api/dev/cluster/install_basics
     */
    devInstallClusterBasics: (params: RequestParams = {}) =>
      this.request<Success, string>({
        path: `/api/dev/cluster/install_basics`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name DevDeleteAllMachines
     * @request DELETE:/api/dev/machines/delete_all
     */
    devDeleteAllMachines: (params: RequestParams = {}) =>
      this.request<Success, string>({
        path: `/api/dev/machines/delete_all`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name CreateMachines
     * @request POST:/api/machines/create
     */
    createMachines: (data: MachineCreationReqBody, params: RequestParams = {}) =>
      this.request<Success, string>({
        path: `/api/machines/create`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name DeleteMachine
     * @request DELETE:/api/machines/delete
     */
    deleteMachine: (data: MachineDeleteReqBody, params: RequestParams = {}) =>
      this.request<Success, string>({
        path: `/api/machines/delete`,
        method: "DELETE",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name GetMachineInfo
     * @request POST:/api/machines/info
     */
    getMachineInfo: (data: MachineInfoReqBody, params: RequestParams = {}) =>
      this.request<MachineInfoResBody, string>({
        path: `/api/machines/info`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name SignalMachine
     * @request POST:/api/machines/signal
     */
    signalMachine: (data: MachineSignalReqBody, params: RequestParams = {}) =>
      this.request<Success, string>({
        path: `/api/machines/signal`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name GetMachineStatus
     * @request GET:/api/machines/status
     */
    getMachineStatus: (params: RequestParams = {}) =>
      this.request<any, any>({
        path: `/api/machines/status`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name DockerTerminal
     * @request GET:/api/terminal/docker/{id}
     */
    dockerTerminal: (id: string, params: RequestParams = {}) =>
      this.request<string, any>({
        path: `/api/terminal/docker/${id}`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @tags crate
     * @name DirectTerminal
     * @request GET:/api/terminal/{id}
     */
    directTerminal: (id: string, params: RequestParams = {}) =>
      this.request<string, any>({
        path: `/api/terminal/${id}`,
        method: "GET",
        ...params,
      }),
  };
  v1 = {
    /**
     * No description
     *
     * @tags crate
     * @name GetBootConfigByMac
     * @request GET:/v1/boot/{mac_addr}
     */
    getBootConfigByMac: (macAddr: string, params: RequestParams = {}) =>
      this.request<Success, PixiecoreBootConfig>({
        path: `/v1/boot/${macAddr}`,
        method: "GET",
        format: "json",
        ...params,
      }),
  };
}
