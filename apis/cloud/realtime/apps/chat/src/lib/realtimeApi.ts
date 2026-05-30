/**
 * Thin client for the realtime-server API.
 *
 * Handles header attachment for the dev-only `X-Realtime-User-Id`
 * auth scheme. Production wiring would swap in a Bearer-token
 * Authorization header without changing call sites.
 */

export type Uuid = string;

export interface ApiResponse<T> {
    message: string;
    status: { Error: string } | "Success";
    data: T | null;
}

export interface Channel {
    id: Uuid;
    owner_id: Uuid;
    name: string;
    topic: string | null;
    created_time: string;
    modified_time: string;
}

export interface ChannelEvent {
    id: Uuid;
    channel_id: Uuid;
    author_id: Uuid;
    event_kind: string | null;
    payload: unknown;
    sent_at: string;
}

export type ChannelFrame =
    | { kind: "ready" }
    | { kind: "event"; event: ChannelEvent }
    | { kind: "lagged"; dropped: number };

const REALTIME_USER_HEADER = "X-Realtime-User-Id";

function headers(userId: Uuid | null, extra: HeadersInit = {}): HeadersInit {
    const h: Record<string, string> = {
        "Content-Type": "application/json",
        ...(Object.fromEntries(new Headers(extra) as unknown as Iterable<[string, string]>)),
    };
    if (userId) h[REALTIME_USER_HEADER] = userId;
    return h;
}

/**
 * Typed error thrown by every `realtimeApi.*` call. `status` is the
 * HTTP status code (0 when the request never reached the server),
 * `kind` is the server-side error tag from the response envelope
 * (`"Unauthorized"`, `"BadRequest"`, …) or `"network"` /
 * `"non-json"` for client-side failures. Callers branch on these
 * fields for friendlier UX — e.g. `e.status === 403` shows a
 * "you don't have permission" notice instead of the raw message.
 * (review B7 / ERR-1)
 */
export class ApiError extends Error {
    readonly status: number;
    readonly kind: string;
    constructor(status: number, kind: string, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.kind = kind;
    }
}

async function callJson<T>(
    path: string,
    method: string,
    userId: Uuid | null,
    body?: unknown
): Promise<T> {
    let res: Response;
    try {
        res = await fetch(path, {
            method,
            headers: headers(userId),
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch (e) {
        throw new ApiError(
            0,
            "network",
            `${method} ${path} failed: ${e instanceof Error ? e.message : String(e)}`
        );
    }
    let parsed: ApiResponse<T>;
    try {
        parsed = (await res.json()) as ApiResponse<T>;
    } catch {
        throw new ApiError(
            res.status,
            "non-json",
            `${method} ${path} returned non-JSON (HTTP ${res.status})`
        );
    }
    if (!res.ok) {
        const kind =
            typeof parsed.status === "object" && parsed.status !== null
                ? parsed.status.Error
                : "error";
        throw new ApiError(res.status, kind, parsed.message);
    }
    if (parsed.data === null || parsed.data === undefined) {
        throw new ApiError(
            res.status,
            "empty-data",
            `${method} ${path} returned no data`
        );
    }
    return parsed.data;
}

export const realtimeApi = {
    seed: () =>
        callJson<{ alice_id: Uuid; bob_id: Uuid }>("/api/dev/seed", "POST", null),

    listChannels: (userId: Uuid) =>
        callJson<{ channels: Channel[] }>("/api/channels/list", "POST", userId),

    createChannel: (userId: Uuid, name: string, topic: string | null) =>
        callJson<{ channel: Channel }>("/api/channels/create", "POST", userId, {
            name,
            topic,
        }),

    listEvents: (userId: Uuid, channelId: Uuid, eventKind?: string) => {
        const qs = new URLSearchParams();
        if (eventKind) qs.set("event_kind", eventKind);
        qs.set("limit", "200");
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        return callJson<{ events: ChannelEvent[] }>(
            `/api/channels/${channelId}/events${suffix}`,
            "GET",
            userId
        );
    },

    publishEvent: (
        userId: Uuid,
        channelId: Uuid,
        eventKind: string | null,
        payload: unknown
    ) =>
        callJson<{ event: ChannelEvent }>(
            `/api/channels/${channelId}/events/publish`,
            "POST",
            userId,
            { event_kind: eventKind, payload }
        ),

    shareChannel: (
        userId: Uuid,
        channelId: Uuid,
        targetUserId: Uuid,
        actions: ("ChannelsRead" | "ChannelsList" | "ChannelsPublish")[]
    ) =>
        callJson<{ policy: { id: Uuid } }>(
            "/api/access_policies/create",
            "POST",
            userId,
            {
                name: `share-${Date.now()}`,
                subject_type: "User",
                subject_id: targetUserId,
                resource_type: "Channel",
                resource_id: channelId,
                actions,
                effect: "Allow",
            }
        ),
};

/** Opens a WebSocket to a channel's live stream. Returns the socket
 * + a one-shot promise that resolves when the server sends the
 * `Ready` frame so callers can race-freely start publishing. */
export function openChannelLiveSocket(
    channelId: Uuid,
    userId: Uuid,
    onFrame: (frame: ChannelFrame) => void
): { socket: WebSocket; ready: Promise<void> } {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/api/channels/${channelId}/live?user=${encodeURIComponent(userId)}`;
    const socket = new WebSocket(url);
    let readyResolve: () => void = () => undefined;
    const ready = new Promise<void>((r) => {
        readyResolve = r;
    });
    socket.onmessage = (ev) => {
        try {
            const frame = JSON.parse(ev.data) as ChannelFrame;
            if (frame.kind === "ready") readyResolve();
            onFrame(frame);
        } catch {
            // Ignore non-JSON frames — the server only sends JSON
            // frames, so this branch is defence-in-depth.
        }
    };
    return { socket, ready };
}
