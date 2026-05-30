/**
 * Thin typed client for the authz-admin BFF.
 *
 * authz-admin doesn't (yet) ship a generated client; the surface
 * is small enough that hand-typing it costs less than wiring
 * codegen. When the surface grows past ~6 endpoints,
 * `swagger-typescript-api` should take over the way it does for
 * filez (see `apis/cloud/filez/server/scripts/codegen.sh`).
 */

export type Uuid = string;

export interface ApiResponse<T> {
    /// `"Success"` on a 2xx; `{Error: kind}` on a 4xx/5xx.
    status: "Success" | { Error: string };
    message: string;
    data: T | null;
}

export interface UpstreamStatus {
    key: string;
    base_url: string;
    /** Probed at request time; false when the upstream's
     * /api/health didn't return 200 within the BFF's 10 s
     * upstream timeout. */
    reachable: boolean;
}

export interface UpstreamsResponse {
    upstreams: UpstreamStatus[];
}

export interface ExplainResponse {
    upstream: string;
    upstream_status: number;
    /** Verbatim JSON from the upstream's
     * /api/access_policies/explain. Shape is upstream-specific;
     * `unwrapEvaluations` below collapses realtime + filez into
     * one array. */
    upstream_body: unknown;
}

/** Per-resource verdict the explain endpoint surfaces. Same field
 * names across realtime and filez — `unwrapEvaluations` does the
 * `evaluations` vs `auth_evaluations` rename. */
export interface AuthEvaluation {
    resource_id: Uuid | null;
    is_allowed: boolean;
    reason: AuthReason;
}

/** Tagged-enum-shaped AuthReason. Most variants are objects with a
 * single key whose value carries `{policy_id, …}`. The two unit
 * variants (`"Owned"`, `"SuperAdmin"`, `"NoMatchingAllowPolicy"`,
 * `"ResourceNotFound"`) are bare strings. Renderers should switch
 * on `typeof reason === "string"` to handle both. */
export type AuthReason =
    | "SuperAdmin"
    | "Owned"
    | "NoMatchingAllowPolicy"
    | "ResourceNotFound"
    | { AllowedByPubliclyAccessible: { policy_id: Uuid } }
    | { AllowedByServerAccessible: { policy_id: Uuid } }
    | { AllowedByDirectUserPolicy: { policy_id: Uuid } }
    | {
          AllowedByDirectUserGroupPolicy: {
              policy_id: Uuid;
              via_user_group_id: Uuid;
          };
      }
    | { AllowedByResourceGroupUserPolicy: { policy_id: Uuid; on_resource_group_id: Uuid } }
    | {
          AllowedByResourceGroupUserGroupPolicy: {
              policy_id: Uuid;
              via_user_group_id: Uuid;
              on_resource_group_id: Uuid;
          };
      }
    | { AllowedByOwnedByOwnerPolicy: { policy_id: Uuid } }
    | { AllowedByAccessibleByOwnerPolicy: { policy_id: Uuid } }
    | { DeniedByPubliclyAccessible: { policy_id: Uuid } }
    | { DeniedByServerAccessible: { policy_id: Uuid } }
    | { DeniedByDirectUserPolicy: { policy_id: Uuid } }
    | {
          DeniedByDirectUserGroupPolicy: {
              policy_id: Uuid;
              via_user_group_id: Uuid;
          };
      }
    | { DeniedByResourceGroupUserPolicy: { policy_id: Uuid; on_resource_group_id: Uuid } }
    | {
          DeniedByResourceGroupUserGroupPolicy: {
              policy_id: Uuid;
              via_user_group_id: Uuid;
              on_resource_group_id: Uuid;
          };
      }
    | { DeniedByOwnedByOwnerPolicy: { policy_id: Uuid } }
    | { DeniedByAccessibleByOwnerPolicy: { policy_id: Uuid } };

/** Extract the evaluations array from an upstream response.
 * After review-3 R4 both realtime + filez emit
 * `{ data: { evaluations: AuthEvaluation[] } }`, so this just
 * walks the envelope; a stale upstream that still uses the old
 * `auth_evaluations` name will return [], the empty-state
 * placeholder will render, and the developer notices
 * immediately. */
export function unwrapEvaluations(upstream_body: unknown): AuthEvaluation[] {
    if (
        upstream_body &&
        typeof upstream_body === "object" &&
        "data" in upstream_body &&
        upstream_body.data &&
        typeof upstream_body.data === "object" &&
        "evaluations" in upstream_body.data &&
        Array.isArray((upstream_body.data as Record<string, unknown>).evaluations)
    ) {
        return (upstream_body.data as { evaluations: AuthEvaluation[] }).evaluations;
    }
    return [];
}

/** Render `AuthReason` as a short human label for table cells.
 * Detailed `policy_id` / `via_user_group_id` rendering belongs in
 * a row-detail expander; this is the at-a-glance form.
 *
 * The `_exhaustive` line is the TypeScript escape hatch that
 * turns a future Rust-side AuthReason addition into a compile
 * error here — if `mows_auth_core::AuthReason` gains a variant
 * that isn't in this file, the assignment to `never` fails and
 * the build surfaces the drift. Catches review-3 R8 / TECH-12
 * / SLOP-4 the next time anyone touches this file. */
export function authReasonLabel(reason: AuthReason): string {
    if (typeof reason === "string") return reason;
    const key = Object.keys(reason)[0];
    if (key) return key;
    const _exhaustive: never = reason as never;
    return String(_exhaustive);
}

const DEFAULT_USER_HEADERS: Array<[string, string]> = [];

async function call<T>(
    path: string,
    init: RequestInit,
    devUserHeaders: Array<[string, string]> = DEFAULT_USER_HEADERS
): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    for (const [k, v] of devUserHeaders) headers.set(k, v);
    const res = await fetch(path, { ...init, headers });
    let envelope: ApiResponse<T>;
    try {
        envelope = (await res.json()) as ApiResponse<T>;
    } catch {
        throw new Error(`${init.method} ${path} returned non-JSON (HTTP ${res.status})`);
    }
    if (!res.ok || envelope.data == null) {
        const kind =
            typeof envelope.status === "object" && envelope.status !== null
                ? envelope.status.Error
                : "error";
        throw new Error(`${kind}: ${envelope.message}`);
    }
    return envelope.data;
}

export const api = {
    listUpstreams: () => call<UpstreamsResponse>("/api/upstreams", { method: "GET" }),

    /** Forward an explain query to one upstream. `devUserHeaders`
     * is the BFF's auth-passthrough channel — set
     * `[["x-realtime-user-id", uid]]` for realtime, etc.
     * Production replaces this with a Bearer token in the
     * `Authorization` header (also passthrough'd by the BFF). */
    explain: (
        body: { upstream: string; resource_type: string; action: string },
        devUserHeaders: Array<[string, string]> = DEFAULT_USER_HEADERS
    ) =>
        call<ExplainResponse>(
            "/api/access_policies/explain",
            { method: "POST", body: JSON.stringify(body) },
            devUserHeaders
        ),
};
