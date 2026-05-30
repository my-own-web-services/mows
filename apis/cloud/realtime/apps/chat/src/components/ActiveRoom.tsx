import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@my-own-web-services/react-components/components/ui/button";
import { Input } from "@my-own-web-services/react-components/components/ui/input";
import ShareDialog from "./ShareDialog";
import { cn } from "../lib/cn";
import {
    openChannelLiveSocket,
    realtimeApi,
    type Channel,
    type ChannelEvent,
    type Uuid,
} from "../lib/realtimeApi";

interface KnownUser {
    id: Uuid;
    label: string;
}

interface ActiveRoomProps {
    readonly channel: Channel;
    readonly actingUser: Uuid;
    readonly knownUsers: KnownUser[];
    readonly onShare: (
        channelId: Uuid,
        targetUserId: Uuid,
        actions: ("ChannelsRead" | "ChannelsList" | "ChannelsPublish")[]
    ) => Promise<void>;
}

const CHAT_EVENT_KIND = "chat.message";
/// Cap the rendered event list so a long-lived room doesn't grow an
/// in-memory array forever (review B5). The durable log is in
/// Postgres + reachable via REST when older messages are needed.
const MAX_RENDERED_EVENTS = 500;

/** De-duplicate events by id, sort chronologically, and cap at
 * MAX_RENDERED_EVENTS. Newer occurrences of the same id win
 * (a re-broadcast after a `lagged` frame may carry updated
 * server-side state). (review B6 + C1) */
function mergeEvents(
    current: ChannelEvent[],
    incoming: ChannelEvent[]
): ChannelEvent[] {
    const map = new Map<string, ChannelEvent>();
    for (const ev of current) map.set(ev.id, ev);
    for (const ev of incoming) map.set(ev.id, ev);
    // Sort by sent_at: a lagged-triggered reload can bring in older
    // events that were missed live, and pure insertion order would
    // append them after the newer live events that already sit in
    // `current`. ISO-8601 timestamps sort lexicographically, but
    // we use Date for clarity + tie-break by id for stability when
    // the server emits two events in the same millisecond.
    const out = Array.from(map.values()).sort((a, b) => {
        const ta = Date.parse(a.sent_at);
        const tb = Date.parse(b.sent_at);
        if (ta !== tb) return ta - tb;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return out.length > MAX_RENDERED_EVENTS
        ? out.slice(out.length - MAX_RENDERED_EVENTS)
        : out;
}

/**
 * Active room view. Subscribes to the channel's live WS stream
 * + renders chat-tagged events. The realtime API stores arbitrary
 * event_kinds; this app filters down to `chat.message` for display
 * and stamps every outgoing message with the same tag.
 */
export default function ActiveRoom({
    channel,
    actingUser,
    knownUsers,
    onShare,
}: ActiveRoomProps) {
    const [events, setEvents] = useState<ChannelEvent[]>([]);
    const [wsReady, setWsReady] = useState(false);
    const [draft, setDraft] = useState("");
    const [sendError, setSendError] = useState<string | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const eventsRef = useRef<HTMLDivElement | null>(null);

    const reloadHistory = useCallback(async () => {
        setHistoryError(null);
        try {
            const res = await realtimeApi.listEvents(
                actingUser,
                channel.id,
                CHAT_EVENT_KIND
            );
            // listEvents returns newest-first; reverse so the
            // newest message renders at the bottom of the list.
            // Merge through the dedup map so a `lagged`-triggered
            // reload doesn't double-render any events that also
            // arrived live via the WS in-flight (review B6).
            const ordered = [...res.events].reverse();
            setEvents((prev) => mergeEvents(prev, ordered));
        } catch (e) {
            setHistoryError(e instanceof Error ? e.message : String(e));
        }
    }, [actingUser, channel.id]);

    // Keep a stable ref to reloadHistory so the WS-subscription
    // effect doesn't tear down + re-open the socket every time
    // reloadHistory is re-memoized (review B4 / REACT-1).
    const reloadHistoryRef = useRef(reloadHistory);
    useEffect(() => {
        reloadHistoryRef.current = reloadHistory;
    }, [reloadHistory]);

    // Initial history fetch + WS subscription. Deps are the true
    // identity-of-the-stream values only — re-running this effect
    // means tearing down the socket, so it must not fire on
    // unrelated re-renders.
    useEffect(() => {
        let cancelled = false;
        void reloadHistoryRef.current();
        const { socket, ready } = openChannelLiveSocket(
            channel.id,
            actingUser,
            (frame) => {
                if (cancelled) return;
                if (frame.kind === "event") {
                    // Filter by tag client-side so the UI ignores
                    // presence pings, webrtc signaling, etc. when
                    // they ride the same channel.
                    if (frame.event.event_kind === CHAT_EVENT_KIND) {
                        setEvents((prev) => mergeEvents(prev, [frame.event]));
                    }
                } else if (frame.kind === "lagged") {
                    void reloadHistoryRef.current();
                }
            }
        );
        void ready.then(() => {
            if (!cancelled) setWsReady(true);
        });
        return () => {
            cancelled = true;
            socket.close();
        };
    }, [actingUser, channel.id]);

    // Auto-scroll on new events.
    useEffect(() => {
        const el = eventsRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [events]);

    const send = useCallback(async () => {
        const body = draft.trim();
        if (!body) return;
        setSendError(null);
        try {
            await realtimeApi.publishEvent(actingUser, channel.id, CHAT_EVENT_KIND, {
                body,
            });
            setDraft("");
            // WS pushes the message back, so no manual list update.
        } catch (e) {
            setSendError(e instanceof Error ? e.message : String(e));
        }
    }, [actingUser, channel.id, draft]);

    const labelFor = useCallback(
        (uid: Uuid) =>
            knownUsers.find((u) => u.id === uid)?.label ?? `${uid.slice(0, 8)}…`,
        [knownUsers]
    );

    return (
        <section className="flex h-full flex-col overflow-hidden">
            <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
                <div className="flex flex-col">
                    <h2 className="text-sm font-semibold">#{channel.name}</h2>
                    {channel.topic && (
                        <span className="text-xs text-muted-foreground">
                            {channel.topic}
                        </span>
                    )}
                </div>
                <span
                    className={cn(
                        "ml-2 inline-flex items-center gap-1 text-xs",
                        wsReady ? "text-green-600" : "text-muted-foreground"
                    )}
                >
                    <span
                        className={cn(
                            "inline-block h-2 w-2 rounded-full",
                            wsReady ? "bg-green-500" : "bg-muted-foreground"
                        )}
                    />
                    {wsReady ? "live" : "connecting…"}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
                        Share
                    </Button>
                </div>
            </header>

            <div
                ref={eventsRef}
                className="flex-1 overflow-y-auto px-4 py-3"
            >
                {historyError && (
                    <p className="text-sm text-destructive">{historyError}</p>
                )}
                {events.length === 0 && !historyError && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        No messages yet — say hi!
                    </p>
                )}
                <ul className="flex flex-col gap-2">
                    {events.map((ev) => (
                        <li key={ev.id} className="flex flex-col">
                            <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium">
                                    {labelFor(ev.author_id)}
                                </span>
                                <time className="text-xs text-muted-foreground">
                                    {new Date(ev.sent_at + "Z").toLocaleTimeString()}
                                </time>
                            </div>
                            <div className="rounded-md bg-secondary px-2 py-1 text-sm text-secondary-foreground">
                                {bodyOf(ev)}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <footer className="border-t border-border bg-card px-4 py-3">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder={`Message #${channel.name}`}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void send();
                            }
                        }}
                    />
                    <Button onClick={() => void send()} disabled={!draft.trim()}>
                        Send
                    </Button>
                </div>
                {sendError && (
                    <p className="mt-2 text-xs text-destructive">{sendError}</p>
                )}
            </footer>

            <ShareDialog
                open={shareOpen}
                onOpenChange={setShareOpen}
                channelName={channel.name}
                knownUsers={knownUsers}
                actingUser={actingUser}
                onConfirm={async (targetUserId, actions) => {
                    await onShare(channel.id, targetUserId, actions);
                    setShareOpen(false);
                }}
            />
        </section>
    );
}

/** Pulls the chat body text out of an event payload. The chat app's
 * contract on `chat.message` events is `{body: string}`; anything
 * else is a contract violation and should be visible (not silently
 * pretty-printed as JSON, which would mask the bug). We render an
 * explicit "[unsupported chat payload shape]" notice and log the
 * offending event for inspection. (review B3 / SLOP-3) */
function bodyOf(ev: ChannelEvent): string {
    if (
        ev.payload &&
        typeof ev.payload === "object" &&
        "body" in ev.payload &&
        typeof (ev.payload as { body: unknown }).body === "string"
    ) {
        return (ev.payload as { body: string }).body;
    }
    console.warn(
        "[chat] event has unexpected payload shape — expected {body: string}",
        ev
    );
    return "[unsupported chat payload shape]";
}
