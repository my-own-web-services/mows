import { useEffect, useMemo, useState } from "react";
import { Button } from "@my-own-web-services/react-components/components/ui/button";
import { Input } from "@my-own-web-services/react-components/components/ui/input";
import { Label } from "@my-own-web-services/react-components/components/ui/label";
import {
    api,
    authReasonLabel,
    unwrapAuditLog,
    unwrapByResource,
    unwrapEvaluations,
    type AuditLogEntry,
    type AuthEvaluation,
    type AuthReason,
    type ByResourcePolicy,
    type ByResourceUpstreamBody,
    type UpstreamStatus,
} from "../lib/api";
import { cn } from "../lib/cn";

/** Hardcoded per-upstream (resource_type, action) pairs that
 * authz-admin understands today. Phase 7 follow-ups will turn
 * this into a `GET /api/upstreams/<key>/vocabulary` call so the
 * frontend doesn't bake in upstream schema knowledge. */
const UPSTREAM_DEFAULTS: Record<string, { resource_type: string; action: string }> = {
    realtime: { resource_type: "Channel", action: "ChannelsList" },
    filez: { resource_type: "File", action: "FilezFilesGet" },
};

/** Per-upstream defaults for the "Who can see X?" panel. Same
 * resource_type vocabulary as explain (no `action` because
 * by_resource enumerates *all* policies pinning the resource,
 * not a per-action verdict). */
const BY_RESOURCE_DEFAULTS: Record<string, { resource_type: string }> = {
    realtime: { resource_type: "Channel" },
    filez: { resource_type: "File" },
};

const DEV_HEADER_PER_UPSTREAM: Record<string, string | undefined> = {
    realtime: "x-realtime-user-id",
    filez: "x-filez-user-id",
};

/** Sentinel value the engine uses as the `subject_id` for the
 * `Public` / `ServerMember` subject types. Surfacing the literal
 * nil UUID to the operator is noisy; renderers replace it with the
 * subject-type keyword. Review R13. */
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

interface UpstreamTabsProps {
    /** Resolved upstreams from `/api/upstreams`. */
    readonly upstreams: UpstreamStatus[];
    /** Acting user UUID — sent verbatim as the upstream's dev
     * identity header (`x-realtime-user-id` for realtime, etc.).
     * Production replaces this with a Bearer token. */
    readonly actingUser: string;
}

export default function UpstreamTabs({ upstreams, actingUser }: UpstreamTabsProps) {
    const reachable = useMemo(() => upstreams.filter((u) => u.reachable), [upstreams]);
    const [active, setActive] = useState<string | null>(reachable[0]?.key ?? null);

    useEffect(() => {
        if (!active && reachable.length > 0) setActive(reachable[0].key);
    }, [active, reachable]);

    if (upstreams.length === 0) {
        return (
            <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
                No upstreams configured. Set <code>REALTIME_BASE_URL</code> /{" "}
                <code>FILEZ_BASE_URL</code> on the authz-admin-server deploy.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div role="tablist" className="flex flex-wrap items-center gap-1 border-b border-border">
                {upstreams.map((up) => (
                    <button
                        key={up.key}
                        role="tab"
                        aria-selected={active === up.key}
                        disabled={!up.reachable}
                        onClick={() => setActive(up.key)}
                        className={cn(
                            "rounded-t-md px-3 py-2 text-sm",
                            active === up.key
                                ? "border border-border border-b-0 bg-card text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            !up.reachable && "cursor-not-allowed opacity-50"
                        )}
                    >
                        {up.key}
                        {!up.reachable && (
                            <span className="ml-2 text-xs text-destructive">
                                unreachable
                            </span>
                        )}
                    </button>
                ))}
            </div>
            {active && (
                <div className="flex flex-col gap-6">
                    <ExplainPanel
                        key={`explain:${active}`}
                        upstream={active}
                        actingUser={actingUser}
                    />
                    <ByResourcePanel
                        key={`by-resource:${active}`}
                        upstream={active}
                        actingUser={actingUser}
                    />
                    <AuditLogPanel
                        key={`audit-log:${active}`}
                        upstream={active}
                        actingUser={actingUser}
                    />
                </div>
            )}
        </div>
    );
}

interface ExplainPanelProps {
    readonly upstream: string;
    readonly actingUser: string;
}

function ExplainPanel({ upstream, actingUser }: ExplainPanelProps) {
    const defaults = UPSTREAM_DEFAULTS[upstream] ?? {
        resource_type: "",
        action: "",
    };
    const [resourceType, setResourceType] = useState(defaults.resource_type);
    const [action, setAction] = useState(defaults.action);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [upstreamStatus, setUpstreamStatus] = useState<number | null>(null);
    const [evaluations, setEvaluations] = useState<AuthEvaluation[]>([]);

    const run = async () => {
        if (!actingUser.trim()) {
            setError("Set acting user UUID above before running an explain.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const devHeader = DEV_HEADER_PER_UPSTREAM[upstream];
            const headers: Array<[string, string]> = devHeader
                ? [[devHeader, actingUser.trim()]]
                : [];
            const res = await api.explain(
                { upstream, resource_type: resourceType, action },
                headers
            );
            setUpstreamStatus(res.upstream_status);
            setEvaluations(unwrapEvaluations(res.upstream_body));
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={`${upstream}-rt`}>resource_type</Label>
                    <Input
                        id={`${upstream}-rt`}
                        value={resourceType}
                        onChange={(e) => setResourceType(e.target.value)}
                        placeholder={defaults.resource_type}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor={`${upstream}-act`}>action</Label>
                    <Input
                        id={`${upstream}-act`}
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        placeholder={defaults.action}
                    />
                </div>
                <Button onClick={() => void run()} disabled={loading}>
                    {loading ? "running…" : "explain"}
                </Button>
            </div>

            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}

            {upstreamStatus !== null && (
                <p className="text-xs text-muted-foreground">
                    upstream returned HTTP {upstreamStatus} ·{" "}
                    {evaluations.length} evaluation
                    {evaluations.length === 1 ? "" : "s"}
                </p>
            )}

            <EvaluationsTable evaluations={evaluations} />
        </div>
    );
}

function EvaluationsTable({ evaluations }: { evaluations: AuthEvaluation[] }) {
    if (evaluations.length === 0) {
        return (
            <p className="py-6 text-center text-sm text-muted-foreground">
                No evaluations yet — run an explain above.
            </p>
        );
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                        <th className="px-2 py-2">resource_id</th>
                        <th className="px-2 py-2">allowed</th>
                        <th className="px-2 py-2">reason</th>
                        <th className="px-2 py-2">detail</th>
                    </tr>
                </thead>
                <tbody>
                    {evaluations.map((ev, i) => (
                        <tr
                            key={evaluationKey(ev, i)}
                            className="border-b border-border/50"
                        >
                            <td className="px-2 py-2 font-mono text-xs">
                                {ev.resource_id ?? <em>type-level</em>}
                            </td>
                            <td className="px-2 py-2">
                                <span
                                    className={cn(
                                        "inline-flex h-2 w-2 rounded-full",
                                        ev.is_allowed ? "bg-green-500" : "bg-destructive"
                                    )}
                                />
                                <span className="ml-2 text-xs">
                                    {ev.is_allowed ? "allow" : "deny"}
                                </span>
                            </td>
                            <td className="px-2 py-2">{authReasonLabel(ev.reason)}</td>
                            <td className="px-2 py-2 font-mono text-xs text-muted-foreground">
                                <ReasonDetail reason={ev.reason} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** Build a stable React key for an evaluation row. Prefers the
 * policy_id from the reason (every non-Owner / non-Public-with-
 * sentinel variant carries one), falls back to the resource_id
 * plus index for owner shortcuts / type-level evaluations.
 * Without this, two type-level rows collide on
 * `"type-level0"`/`"type-level1"` keys and React reuses DOM
 * nodes across them — caught by review-3 R7 / TECH-9. */
function evaluationKey(ev: AuthEvaluation, index: number): string {
    if (typeof ev.reason !== "string") {
        const inner = Object.values(ev.reason)[0] as { policy_id?: string } | undefined;
        if (inner?.policy_id) return `${ev.resource_id ?? "type"}:${inner.policy_id}`;
    }
    return `${ev.resource_id ?? "type-level"}:${index}`;
}

function ReasonDetail({ reason }: { reason: AuthReason }) {
    if (typeof reason === "string") return null;
    const inner = Object.values(reason)[0] as Record<string, string> | undefined;
    if (!inner) return null;
    return (
        <span>
            {Object.entries(inner)
                .map(([k, v]) => `${k}=${v.toString().slice(0, 8)}…`)
                .join(" · ")}
        </span>
    );
}

interface ByResourcePanelProps {
    readonly upstream: string;
    readonly actingUser: string;
}

/** "Who can see X?" panel — given a resource_id, lists every
 * non-revoked, non-expired policy pinning access to it plus the
 * resource's owner. Backed by the upstream's
 * /api/access_policies/by_resource (the inverse of /explain).
 *
 * Upstream collapses "doesn't exist" and "exists but not yours"
 * into one 403, so the operator sees the same response whether
 * they typo'd or aren't the owner — a deliberate trade-off to
 * defeat UUID-fingerprinting. The UI reflects that via the
 * upstream_status line. */
function ByResourcePanel({ upstream, actingUser }: ByResourcePanelProps) {
    const defaults = BY_RESOURCE_DEFAULTS[upstream] ?? { resource_type: "" };
    const [resourceType, setResourceType] = useState(defaults.resource_type);
    const [resourceId, setResourceId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [upstreamStatus, setUpstreamStatus] = useState<number | null>(null);
    const [payload, setPayload] = useState<ByResourceUpstreamBody | null>(null);

    const run = async () => {
        if (!actingUser.trim()) {
            setError("Set acting user UUID above before asking who can see X.");
            return;
        }
        if (!resourceId.trim()) {
            setError("resource_id is required.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const devHeader = DEV_HEADER_PER_UPSTREAM[upstream];
            const headers: Array<[string, string]> = devHeader
                ? [[devHeader, actingUser.trim()]]
                : [];
            const res = await api.byResource(
                {
                    upstream,
                    resource_type: resourceType,
                    resource_id: resourceId.trim(),
                },
                headers
            );
            setUpstreamStatus(res.upstream_status);
            setPayload(unwrapByResource(res.upstream_body));
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
            <div className="flex flex-col gap-1">
                <h2 className="text-sm font-medium">Who can see X?</h2>
                <p className="text-xs text-muted-foreground">
                    Lists every policy pinning access to one resource.
                    The upstream refuses to disclose anything unless you
                    own the resource — non-existence and non-ownership
                    return the same 403 so a non-owner can't enumerate
                    which ids exist.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={`${upstream}-bres-rt`}>resource_type</Label>
                    <Input
                        id={`${upstream}-bres-rt`}
                        value={resourceType}
                        onChange={(e) => setResourceType(e.target.value)}
                        placeholder={defaults.resource_type}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor={`${upstream}-bres-id`}>resource_id</Label>
                    <Input
                        id={`${upstream}-bres-id`}
                        value={resourceId}
                        onChange={(e) => setResourceId(e.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000000"
                    />
                </div>
                <Button onClick={() => void run()} disabled={loading}>
                    {loading ? "running…" : "who can see X?"}
                </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {upstreamStatus !== null && upstreamStatus !== 200 && (
                <p className="text-xs text-destructive">
                    upstream returned HTTP {upstreamStatus} — the request
                    was rejected (often "no such resource OR you're not
                    the owner", deliberately indistinguishable to defeat
                    UUID-fingerprinting).
                </p>
            )}
            {upstreamStatus === 200 && payload !== null && (
                <p className="text-xs text-muted-foreground">
                    owner{" "}
                    <span className="font-mono">
                        {payload.resource_owner_id ?? "<none>"}
                    </span>
                    {" · "}
                    {payload.policies.length} polic
                    {payload.policies.length === 1 ? "y" : "ies"}
                </p>
            )}

            <PoliciesTable payload={payload} />
        </div>
    );
}

function PoliciesTable({ payload }: { payload: ByResourceUpstreamBody | null }) {
    if (payload === null) {
        return (
            <p className="py-6 text-center text-sm text-muted-foreground">
                No data yet — enter a resource id and run the query.
            </p>
        );
    }
    if (payload.policies.length === 0) {
        return (
            <p className="py-6 text-center text-sm text-muted-foreground">
                Owner is the only one with access — no policies pin this
                resource.
            </p>
        );
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                        <th className="px-2 py-2">policy_id</th>
                        <th className="px-2 py-2">effect</th>
                        <th className="px-2 py-2">subject_type</th>
                        <th className="px-2 py-2">subject_id</th>
                        <th className="px-2 py-2">actions</th>
                    </tr>
                </thead>
                <tbody>
                    {payload.policies.map((p) => (
                        <tr key={p.id} className="border-b border-border/50">
                            <td className="px-2 py-2 font-mono text-xs">
                                {p.id.slice(0, 8)}…
                            </td>
                            <td className="px-2 py-2">
                                <span
                                    className={cn(
                                        "inline-flex h-2 w-2 rounded-full",
                                        p.effect === "Allow"
                                            ? "bg-green-500"
                                            : "bg-destructive"
                                    )}
                                />
                                <span className="ml-2 text-xs">{p.effect}</span>
                            </td>
                            <td className="px-2 py-2">{p.subject_type}</td>
                            <td className="px-2 py-2 font-mono text-xs">
                                {formatSubjectId(p)}
                            </td>
                            <td className="px-2 py-2 text-xs">
                                {(p.actions ?? []).join(", ") || (
                                    <em className="text-muted-foreground">all</em>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** `Public` and `ServerMember` carry the nil UUID as a sentinel
 * subject_id — surfacing that nil to the operator is pointless
 * and misleading. Render the sentinel as the subject_type
 * keyword instead. */
function formatSubjectId(p: ByResourcePolicy): string {
    if (p.subject_id === NIL_UUID) {
        return p.subject_type === "Public" || p.subject_type === "ServerMember"
            ? `<${p.subject_type.toLowerCase()}>`
            : NIL_UUID;
    }
    return `${p.subject_id.slice(0, 8)}…`;
}

interface AuditLogPanelProps {
    readonly upstream: string;
    readonly actingUser: string;
}

/** Phase 7 audit-log timeline panel — third panel per upstream tab.
 * Two modes mirror the upstream:
 *   1. Resource-scoped: caller fills `resource_type` + `resource_id`
 *      and must own the resource. Upstream collapses not-found +
 *      not-owner into one 403 (same UUID-fingerprinting defence as
 *      by_resource).
 *   2. Self-scoped: caller leaves both filters blank → upstream
 *      returns the caller's own actions.
 *
 * Pagination is keyset (`next_cursor` from one page becomes the
 * `cursor` of the next). The "Load more" button is the only way
 * to advance — no auto-paging.
 */
function AuditLogPanel({ upstream, actingUser }: AuditLogPanelProps) {
    const defaults = BY_RESOURCE_DEFAULTS[upstream] ?? { resource_type: "" };
    const [resourceType, setResourceType] = useState(defaults.resource_type);
    const [resourceId, setResourceId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [upstreamStatus, setUpstreamStatus] = useState<number | null>(null);
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    /** Resource scope is "both filled" or "both empty" — partial
     * configurations are a 400 from the upstream (defense-in-
     * depth: upstream also rejects them; the client guard just
     * surfaces the error before the round-trip). Review SLOP-11. */
    const partialScope =
        (resourceType.trim() !== "" && resourceId.trim() === "") ||
        (resourceType.trim() === "" && resourceId.trim() !== "");

    const run = async (cursor: string | null) => {
        if (!actingUser.trim()) {
            setError("Set acting user UUID above before fetching the audit log.");
            return;
        }
        if (partialScope) {
            setError("resource_type + resource_id must be supplied together.");
            return;
        }
        // R7 / QA-5 / SLOP-10 — refuse to re-issue with the same
        // cursor we just consumed. A buggy upstream that returns
        // the same `next_cursor` after a "Load more" would
        // otherwise let the operator click the button forever,
        // appending duplicate rows to the table on each click.
        if (cursor !== null && cursor === nextCursor && entries.length > 0) {
            setError(
                "Upstream returned the same next_cursor twice — pagination is stuck. " +
                    "No more entries will be loaded."
            );
            setNextCursor(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const devHeader = DEV_HEADER_PER_UPSTREAM[upstream];
            const headers: Array<[string, string]> = devHeader
                ? [[devHeader, actingUser.trim()]]
                : [];
            const body: Parameters<typeof api.auditLog>[0] = { upstream };
            if (resourceType.trim() !== "") {
                body.resource_type = resourceType.trim();
                body.resource_id = resourceId.trim();
            }
            if (cursor !== null) body.cursor = cursor;
            const res = await api.auditLog(body, headers);
            setUpstreamStatus(res.upstream_status);
            const unwrapped = unwrapAuditLog(res.upstream_body);
            if (unwrapped === null) {
                // Upstream returned an error envelope — clear the
                // page so the operator doesn't think the previous
                // result still applies.
                if (cursor === null) setEntries([]);
                setNextCursor(null);
            } else if (cursor === null) {
                setEntries(unwrapped.entries);
                setNextCursor(unwrapped.next_cursor);
            } else {
                // Append on "Load more".
                setEntries((prev) => [...prev, ...unwrapped.entries]);
                setNextCursor(unwrapped.next_cursor);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
            <div className="flex flex-col gap-1">
                <h2 className="text-sm font-medium">Audit log</h2>
                <p className="text-xs text-muted-foreground">
                    Leave both filters blank to see your own actions. Fill
                    resource_type + resource_id together to see every event
                    on a resource you own (non-owners get a 403 collapsed
                    with the not-found response).
                </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <div className="flex flex-col gap-1">
                    <Label htmlFor={`${upstream}-aud-rt`}>resource_type</Label>
                    <Input
                        id={`${upstream}-aud-rt`}
                        value={resourceType}
                        onChange={(e) => setResourceType(e.target.value)}
                        placeholder={`${defaults.resource_type} (optional)`}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor={`${upstream}-aud-id`}>resource_id</Label>
                    <Input
                        id={`${upstream}-aud-id`}
                        value={resourceId}
                        onChange={(e) => setResourceId(e.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000000 (optional)"
                    />
                </div>
                <Button onClick={() => void run(null)} disabled={loading}>
                    {loading ? "loading…" : "fetch"}
                </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {upstreamStatus !== null && upstreamStatus !== 200 && (
                <p className="text-xs text-destructive">
                    upstream returned HTTP {upstreamStatus} — the request
                    was rejected (often "no such resource OR you're not
                    the owner").
                </p>
            )}
            {upstreamStatus === 200 && (
                <p className="text-xs text-muted-foreground">
                    {entries.length} entr{entries.length === 1 ? "y" : "ies"}
                    {nextCursor !== null && " · more available"}
                </p>
            )}

            <AuditEntriesTable entries={entries} />

            {nextCursor !== null && (
                <div className="flex justify-center">
                    <Button
                        variant="outline"
                        onClick={() => void run(nextCursor)}
                        disabled={loading}
                    >
                        {loading ? "loading…" : "Load more"}
                    </Button>
                </div>
            )}
        </div>
    );
}

function AuditEntriesTable({ entries }: { entries: AuditLogEntry[] }) {
    if (entries.length === 0) {
        return (
            <p className="py-6 text-center text-sm text-muted-foreground">
                No entries yet — fetch above.
            </p>
        );
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                        <th className="px-2 py-2">ts</th>
                        <th className="px-2 py-2">event_type</th>
                        <th className="px-2 py-2">actor</th>
                        <th className="px-2 py-2">resource</th>
                        <th className="px-2 py-2">metadata</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map((e) => (
                        <tr key={e.id} className="border-b border-border/50">
                            <td className="px-2 py-2 font-mono text-xs">
                                {e.ts.replace("T", " ")}
                            </td>
                            <td className="px-2 py-2">{e.event_type}</td>
                            <td className="px-2 py-2 font-mono text-xs">
                                {e.actor_id !== null
                                    ? `${e.actor_id.slice(0, 8)}…`
                                    : <em className="text-muted-foreground">system</em>}
                            </td>
                            <td className="px-2 py-2 font-mono text-xs">
                                {e.resource_id !== null
                                    ? `${e.resource_type}/${e.resource_id.slice(0, 8)}…`
                                    : <em className="text-muted-foreground">type-level</em>}
                            </td>
                            <td className="px-2 py-2 text-xs text-muted-foreground">
                                {formatMetadata(e.metadata)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** Render an audit-event metadata blob as a compact "k=v · k=v"
 * string. Drops the redundant `event_type` key — the adjacent
 * column already renders it as the primary axis, so duplicating
 * it in the metadata cell would just push the meaningful fields
 * off-screen (review R6 / SLOP-9). New per-event metadata fields
 * land here automatically; if a field needs its own column it
 * should be promoted in `AuditEntriesTable` deliberately.
 * Stringifies non-scalar values via JSON so a nested object renders
 * as `{...}` rather than `[object Object]`. */
function formatMetadata(metadata: Record<string, unknown>): string {
    return Object.entries(metadata)
        .filter(([k]) => k !== "event_type")
        .map(([k, v]) => {
            if (typeof v === "string") return `${k}=${v.length > 24 ? v.slice(0, 24) + "…" : v}`;
            if (typeof v === "number" || typeof v === "boolean") return `${k}=${v}`;
            return `${k}=${JSON.stringify(v).slice(0, 32)}`;
        })
        .join(" · ");
}
