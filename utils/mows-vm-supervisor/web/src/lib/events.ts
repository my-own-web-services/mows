// WebSocket subscription to the supervisor's `/v1/events` stream.
//
// One module-scoped singleton manages the connection: every React subscriber
// taps into the same socket, so the browser only ever holds one open
// connection regardless of how many `useLiveData` hooks are mounted. The
// socket re-opens with exponential backoff (capped at 30 s) on close/error
// and dispatches a synthetic `resync` event after each reconnect so
// subscribers refetch in case they missed mutations while disconnected.
//
// Replaces the previous `setInterval(..., 2000)` pollers in Sidebar and
// VmDetail — the backend now pushes a notification whenever a VM/agent
// row changes; subscribers re-fetch on demand via REST.

const TOKEN_STORAGE_KEY = "mows-vm-supervisor:token";

export type SupervisorEvent =
    | { type: "vm_created"; id: string }
    | { type: "vm_updated"; id: string }
    | { type: "vm_deleted"; id: string }
    | { type: "agent_created"; id: string; vm_id: string }
    | { type: "agent_updated"; id: string }
    | { type: "agent_deleted"; id: string }
    | { type: "resync" };

export type EventListener = (event: SupervisorEvent) => void;
export type Unsubscribe = () => void;

const listeners = new Set<EventListener>();
let socket: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: number | null = null;
let stopped = false;

const isSupervisorEvent = (value: unknown): value is SupervisorEvent =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type: unknown }).type === "string";

const dispatch = (event: SupervisorEvent): void => {
    // Snapshot the listener set so a subscriber that unsubscribes inside
    // its handler doesn't perturb iteration.
    for (const listener of Array.from(listeners)) {
        try {
            listener(event);
        } catch (error) {
            // A handler throwing must not break the dispatch loop for other
            // subscribers — log and move on.

            console.error("supervisor event listener failed", error);
        }
    }
};

const scheduleReconnect = (): void => {
    if (stopped || reconnectTimer !== null) return;
    reconnectAttempts += 1;
    const delay = Math.min(
        30_000,
        500 * Math.pow(2, Math.min(reconnectAttempts - 1, 6))
    );
    reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        openSocket();
    }, delay);
};

const openSocket = (): void => {
    if (stopped) return;
    if (socket && socket.readyState === WebSocket.OPEN) return;
    const token = localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url =
        `${wsProtocol}://${window.location.host}/v1/events` +
        (token ? `?token=${encodeURIComponent(token)}` : "");
    const ws = new WebSocket(url);
    socket = ws;

    ws.onopen = () => {
        const wasReconnect = reconnectAttempts > 0;
        reconnectAttempts = 0;
        // A successful reconnect means we may have missed mutations while
        // the socket was down. Replay-on-the-server isn't worth it for the
        // ~10 KB list payloads — dispatch a synthetic resync so every
        // subscriber refetches.
        if (wasReconnect) dispatch({ type: "resync" });
    };

    ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
            const parsed: unknown = JSON.parse(event.data);
            if (isSupervisorEvent(parsed)) dispatch(parsed);
        } catch {
            // Malformed frame — ignore.
        }
    };

    ws.onerror = () => {
        // `onclose` fires immediately after `onerror`; defer reconnect to
        // close so we don't double-schedule.
    };

    ws.onclose = () => {
        if (socket === ws) socket = null;
        scheduleReconnect();
    };
};

/**
 * Subscribe to supervisor state-change events. Opens the websocket on the
 * first subscriber; subsequent subscribers share the connection. Returns
 * an unsubscribe function — the connection stays open after the last
 * subscriber leaves (cheap to keep, and the next mount re-uses it).
 */
export const subscribeEvents = (listener: EventListener): Unsubscribe => {
    listeners.add(listener);
    if (!socket) {
        stopped = false;
        openSocket();
    }
    return () => {
        listeners.delete(listener);
    };
};

/**
 * Test-only hook for tearing down the socket between cases. Not used by
 * application code; the singleton is meant to live for the full session.
 */
export const _shutdownEventsForTesting = (): void => {
    stopped = true;
    if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (socket) {
        socket.close();
        socket = null;
    }
    listeners.clear();
    reconnectAttempts = 0;
};
