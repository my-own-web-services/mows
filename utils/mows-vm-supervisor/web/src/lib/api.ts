// Tiny wrapper around the generated swagger-typescript-api client.
//
// The generated client (web/src/api/generated/api-client.ts) is regenerated
// from openapi.json by scripts/codegen.sh and committed to the tree — no
// network/runtime dependency. The supervisor's REST surface is exposed via
// the `Api` class's `.v1` namespace; we wire `securityWorker` to attach the
// `Authorization: Bearer <token>` header from localStorage so every call
// honours the auth flow without bespoke fetch wiring.

import { Api, type CreateVmRequest } from "../api/generated/api-client";

export type {
    AgentSummary,
    CreateAgentRequest,
    CreateUserRequest,
    CreateVmRequest,
    ErrorResponse,
    HealthResponse,
    LoginRequest,
    LoginResponse,
    OperationResult,
    UserSummary,
    VmSshInfo,
    VmSummary
} from "../api/generated/api-client";

const TOKEN_STORAGE_KEY = "mows-vm-supervisor:token";

// `securityWorker` only fires on requests that opt in via `secure: true` —
// for the supervisor every authenticated endpoint should send the token, so
// turn it on globally via `baseApiParams`.
const api = new Api({
    baseUrl: "",
    baseApiParams: { secure: true },
    securityWorker: () => {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!token) return {};
        return {
            headers: { Authorization: `Bearer ${token}` }
        };
    }
});

// Errors come back from `swagger-typescript-api` as an `HttpResponse` with
// `.error`. Unwrap to the data on success, throw on failure so callers get a
// familiar `try { … } catch` flow.
const unwrap = async <T>(promise: Promise<{ data: T }>): Promise<T> =>
    (await promise).data;

export const listVms = () => unwrap(api.v1.listVms());
export const createVm = (request: CreateVmRequest = {}) =>
    unwrap(api.v1.createVm(request));
export const getVmDefaults = () => unwrap(api.v1.getVmDefaults());
export const stopVm = (id: string) => unwrap(api.v1.stopVm(id));
export const deleteVm = (id: string) => unwrap(api.v1.deleteVm(id));
export const renameVm = (id: string, name: string) =>
    unwrap(api.v1.updateVm(id, { name }));

export const listAgents = () => unwrap(api.v1.listAllAgents());
export const stopAgent = (id: string) => unwrap(api.v1.stopAgent(id));
export const deleteAgent = (id: string) => unwrap(api.v1.deleteAgent(id));
export const renameAgent = (id: string, name: string) =>
    unwrap(api.v1.updateAgent(id, { name }));

export { api };

// swagger-typescript-api rejects with the raw `Response` (plus an `.error`
// body in some shapes), which `String(e)` collapses to "[object Response]".
// Pull a useful message out instead: prefer the JSON `error` field, then
// status text, then a generic fallback.
export const describeApiError = async (error: unknown): Promise<string> => {
    if (error instanceof Response) {
        try {
            const body = await error.clone().json();
            if (body && typeof body === "object") {
                const message = (body as { error?: string; message?: string }).error
                    ?? (body as { message?: string }).message;
                if (message) return message;
            }
        } catch {
            // body wasn't JSON; fall through
        }
        try {
            const text = await error.clone().text();
            if (text) return text;
        } catch {
            // ignore
        }
        return `${error.status} ${error.statusText}`.trim() || "Request failed";
    }
    if (error instanceof Error) return error.message;
    return String(error);
};
