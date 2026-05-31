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

/** One row of the `/by_resource` response. Mirrors the upstream's
 * `AccessPolicy` shape — both realtime and filez serialize the
 * same wire fields out of their own typed structs (same `id`,
 * `subject_type`, `subject_id`, `effect`, `actions`); upstream-
 * specific fields like `resource_scope` / `revoked` are surfaced
 * as `unknown` so the table renders defensively against schema
 * drift instead of throwing on a missing property.
 *
 * @example Realtime emits `{id, owner_id, name, created_time,
 *   modified_time, subject_type, subject_id, context_app_ids,
 *   resource_type, resource_id, actions, effect, resource_scope,
 *   expires_at, revoked, policy_bundle_id}` per its
 *   `AccessPolicy` struct.
 * @example Filez emits the same shape plus filez-specific
 *   typing (e.g. `subject_id` is `AccessPolicySubjectId`, which
 *   serialises as a Uuid string).
 *
 * Fields outside `id` / `subject_type` / `subject_id` / `effect`
 * are optional in this interface — the table renders defensively
 * via `?? ""` / `?? []`. Review R16. */
export interface ByResourcePolicy {
    id: Uuid;
    name?: string;
    subject_type: "User" | "UserGroup" | "ServerMember" | "Public";
    subject_id: Uuid;
    effect: "Allow" | "Deny";
    actions?: string[];
    resource_scope?: "Single" | "OwnedByOwner" | "AccessibleByOwner";
    revoked?: boolean;
    expires_at?: string | null;
    /** Upstream-specific fields (e.g. filez's `context_app_ids`,
     * `policy_bundle_id`) land here without breaking the table. */
    [extra: string]: unknown;
}

/** Body of an upstream `/by_resource` 200 response. */
export interface ByResourceUpstreamBody {
    resource_owner_id: Uuid | null;
    policies: ByResourcePolicy[];
}

export interface ByResourceResponse {
    upstream: string;
    upstream_status: number;
    upstream_body: unknown;
}

/** Pull the `{ resource_owner_id, policies }` payload out of the
 * BFF's envelope. Returns null when the upstream replied with an
 * error envelope (e.g. 403 collapsed not-found-or-not-yours), so
 * the SPA can render "the upstream said HTTP 403" instead of a
 * misleading empty table.
 *
 * Validates the payload shape defensively:
 *   - `resource_owner_id` only kept if it's a string or null;
 *     any other type from a regressed upstream falls back to null
 *     instead of being cast through silently (review R5 / TECH-6).
 *   - policies missing a string `id` are dropped — the React
 *     table keys on `policy.id` and an undefined key collides
 *     across rows, corrupting DOM state on hover/focus
 *     (review R6 / TECH-7). */
export function unwrapByResource(upstream_body: unknown): ByResourceUpstreamBody | null {
    if (
        upstream_body &&
        typeof upstream_body === "object" &&
        "data" in upstream_body &&
        upstream_body.data &&
        typeof upstream_body.data === "object" &&
        "policies" in upstream_body.data &&
        Array.isArray((upstream_body.data as Record<string, unknown>).policies)
    ) {
        const data = upstream_body.data as Record<string, unknown>;
        const owner = data.resource_owner_id;
        const validOwner: Uuid | null =
            typeof owner === "string" || owner === null ? (owner as Uuid | null) : null;
        const policies = (data.policies as ByResourcePolicy[]).filter(
            (p) => p && typeof p === "object" && typeof p.id === "string" && p.id.length > 0
        );
        return {
            resource_owner_id: validOwner,
            policies,
        };
    }
    return null;
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

    /** "Who can see X?" — forwarded to one upstream's
     * /api/access_policies/by_resource. Upstream collapses
     * not-found into 403 to defeat UUID-fingerprinting, so an
     * operator who hasn't shared the resource will see a 403 in
     * `upstream_status` without any disclosure of whether the
     * id exists. */
    byResource: (
        body: { upstream: string; resource_type: string; resource_id: string },
        devUserHeaders: Array<[string, string]> = DEFAULT_USER_HEADERS
    ) =>
        call<ByResourceResponse>(
            "/api/access_policies/by_resource",
            { method: "POST", body: JSON.stringify(body) },
            devUserHeaders
        ),

    /** Audit-log timeline — forwarded to one upstream's
     * /api/audit_log/list. Two modes: resource-scoped (caller
     * passes resource_type + resource_id, must own the resource)
     * or self-scoped (no filters, caller sees their own actions).
     * Keyset pagination via the `cursor` field. */
    auditLog: (
        body: {
            upstream: string;
            resource_type?: string;
            resource_id?: string;
            limit?: number;
            cursor?: string;
        },
        devUserHeaders: Array<[string, string]> = DEFAULT_USER_HEADERS
    ) =>
        call<AuditLogResponse>(
            "/api/audit_log/list",
            { method: "POST", body: JSON.stringify(body) },
            devUserHeaders
        ),

    /** App-revocation panel: list the caller's granted apps. */
    grantedApps: (
        body: { upstream: string },
        devUserHeaders: Array<[string, string]> = DEFAULT_USER_HEADERS
    ) =>
        call<GrantedAppsResponse>(
            "/api/access_policies/granted_apps/list",
            { method: "POST", body: JSON.stringify(body) },
            devUserHeaders
        ),

    /** App-revocation panel: bulk-revoke every non-revoked policy
     * the caller has granted to one app. Idempotent — calling
     * after every policy is already revoked returns
     * `revoked_count: 0`. */
    revokeByApp: (
        body: { upstream: string; context_app_id: string },
        devUserHeaders: Array<[string, string]> = DEFAULT_USER_HEADERS
    ) =>
        call<RevokeByAppResponse>(
            "/api/access_policies/revoke_by_app",
            { method: "POST", body: JSON.stringify(body) },
            devUserHeaders
        ),
};

/** One row of the upstream granted_apps response. */
export interface GrantedApp {
    app_id: Uuid;
    policy_count: number;
}

export interface GrantedAppsUpstreamBody {
    apps: GrantedApp[];
}

export interface GrantedAppsResponse {
    upstream: string;
    upstream_status: number;
    upstream_body: unknown;
}

export interface RevokeByAppUpstreamBody {
    revoked_count: number;
}

export interface RevokeByAppResponse {
    upstream: string;
    upstream_status: number;
    upstream_body: unknown;
}

/** Pull `{apps: [...]}` out of the granted_apps envelope; null on
 * upstream-error envelope. Defensive filter drops malformed rows
 * (missing app_id / non-numeric policy_count) so the React key
 * never collides and the table never renders garbage — same R6 /
 * R8 pattern as the other unwrappers. */
export function unwrapGrantedApps(
    upstream_body: unknown
): GrantedAppsUpstreamBody | null {
    if (
        upstream_body &&
        typeof upstream_body === "object" &&
        "data" in upstream_body &&
        upstream_body.data &&
        typeof upstream_body.data === "object" &&
        "apps" in upstream_body.data &&
        Array.isArray((upstream_body.data as Record<string, unknown>).apps)
    ) {
        const apps = ((upstream_body.data as Record<string, unknown>).apps as GrantedApp[]).filter(
            (a) =>
                a &&
                typeof a === "object" &&
                typeof a.app_id === "string" &&
                a.app_id.length > 0 &&
                typeof a.policy_count === "number"
        );
        return { apps };
    }
    return null;
}

/** Pull `{revoked_count: n}` out of the revoke_by_app envelope.
 * Returns null on an upstream-error envelope; numeric otherwise. */
export function unwrapRevokeByApp(
    upstream_body: unknown
): RevokeByAppUpstreamBody | null {
    if (
        upstream_body &&
        typeof upstream_body === "object" &&
        "data" in upstream_body &&
        upstream_body.data &&
        typeof upstream_body.data === "object" &&
        "revoked_count" in upstream_body.data &&
        typeof (upstream_body.data as Record<string, unknown>).revoked_count === "number"
    ) {
        return {
            revoked_count: (upstream_body.data as { revoked_count: number }).revoked_count
        };
    }
    return null;
}

/** One row of the upstream audit_log response. Mirrors the AuditLog
 * struct on both upstreams — `metadata` is upstream-specific JSON,
 * the SPA renders defensively (table column shows JSON keys, click
 * for full body in a future iteration). */
export interface AuditLogEntry {
    id: Uuid;
    event_type: string;
    actor_id: Uuid | null;
    resource_type: string;
    resource_id: Uuid | null;
    ts: string;
    metadata: Record<string, unknown>;
}

export interface AuditLogUpstreamBody {
    entries: AuditLogEntry[];
    next_cursor: string | null;
}

export interface AuditLogResponse {
    upstream: string;
    upstream_status: number;
    upstream_body: unknown;
}

/** Pull the `{ entries, next_cursor }` payload out of the BFF
 * envelope. Returns null when the upstream replied with an error
 * envelope (e.g. 403 collapsed not-found-or-not-yours), same
 * pattern as `unwrapByResource`. Filters out entries missing
 * required string fields so the React table key never collides
 * on `undefined` ids — same R6 defence the by_resource unwrapper
 * applies, plus an R8 actor_id type guard so a regressed upstream
 * that emits `actor_id: 42` doesn't feed garbage into the table. */
export function unwrapAuditLog(upstream_body: unknown): AuditLogUpstreamBody | null {
    if (
        upstream_body &&
        typeof upstream_body === "object" &&
        "data" in upstream_body &&
        upstream_body.data &&
        typeof upstream_body.data === "object" &&
        "entries" in upstream_body.data &&
        Array.isArray((upstream_body.data as Record<string, unknown>).entries)
    ) {
        const data = upstream_body.data as Record<string, unknown>;
        const next = data.next_cursor;
        const entries = (data.entries as AuditLogEntry[]).filter(
            (entry) =>
                entry &&
                typeof entry === "object" &&
                typeof entry.id === "string" &&
                entry.id.length > 0 &&
                typeof entry.event_type === "string" &&
                typeof entry.ts === "string" &&
                // R8 — actor_id is nullable; reject anything that's
                // neither a string nor null so the table renderer
                // never gets a number / boolean / object slipped
                // through by a regressed upstream.
                (typeof entry.actor_id === "string" || entry.actor_id === null)
        );
        return {
            entries,
            next_cursor: typeof next === "string" ? next : null
        };
    }
    return null;
}
