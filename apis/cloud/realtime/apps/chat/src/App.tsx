import { useCallback, useEffect, useMemo, useState } from "react";
import IdentityBar from "./components/IdentityBar";
import RoomList from "./components/RoomList";
import ActiveRoom from "./components/ActiveRoom";
import { realtimeApi, type Channel, type Uuid } from "./lib/realtimeApi";

interface KnownUser {
    id: Uuid;
    label: string;
}

const STORAGE_KEY = "realtime-chat:acting-user";

/**
 * Top-level chat shell.
 *
 * Two panels: a room list on the left + an active room on the
 * right (composer + live event stream). Identity is held at the
 * top via the dev `X-Realtime-User-Id` header path — production
 * auth swap-in is a separate concern.
 */
export default function App() {
    const [actingUser, setActingUser] = useState<Uuid | null>(() =>
        localStorage.getItem(STORAGE_KEY)
    );
    const [knownUsers, setKnownUsers] = useState<KnownUser[]>(() => {
        const raw = localStorage.getItem(`${STORAGE_KEY}:known-users`);
        return raw ? (JSON.parse(raw) as KnownUser[]) : [];
    });
    const [channels, setChannels] = useState<Channel[] | null>(null);
    const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

    useEffect(() => {
        if (actingUser) localStorage.setItem(STORAGE_KEY, actingUser);
        else localStorage.removeItem(STORAGE_KEY);
    }, [actingUser]);
    useEffect(() => {
        localStorage.setItem(
            `${STORAGE_KEY}:known-users`,
            JSON.stringify(knownUsers)
        );
    }, [knownUsers]);

    // Cross-tab sync: the `storage` event only fires in OTHER
    // tabs/windows of the same origin when localStorage changes.
    // Without this, two tabs of the chat app silently overwrite
    // each other's identity + known-users on the next setState
    // round-trip. (review B11 / QA-2 / SLOP-4)
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.storageArea !== localStorage) return;
            if (e.key === STORAGE_KEY) {
                setActingUser(e.newValue);
            } else if (e.key === `${STORAGE_KEY}:known-users`) {
                try {
                    setKnownUsers(
                        e.newValue ? (JSON.parse(e.newValue) as KnownUser[]) : []
                    );
                } catch (parseErr) {
                    // Corrupt JSON in the foreign tab — keep this
                    // tab's identity intact, but surface the
                    // corruption so a developer can diagnose how
                    // the bad value got written. (review C7)
                    console.warn(
                        "[chat] dropped cross-tab known-users update with unparseable JSON",
                        { raw: e.newValue, parseErr }
                    );
                }
            } else if (e.key === null) {
                // localStorage.clear() in another tab — reset both.
                setActingUser(null);
                setKnownUsers([]);
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const refreshChannels = useCallback(async () => {
        if (!actingUser) {
            setChannels([]);
            return;
        }
        try {
            const res = await realtimeApi.listChannels(actingUser);
            setChannels(res.channels);
        } catch (e) {
            console.error("listChannels failed", e);
            setChannels([]);
        }
    }, [actingUser]);

    useEffect(() => {
        refreshChannels();
    }, [refreshChannels]);

    // Drop the active channel selection if it's no longer in the
    // visible list (caller might have lost access via a policy
    // revoke).
    useEffect(() => {
        if (
            activeChannel &&
            channels &&
            !channels.some((c) => c.id === activeChannel.id)
        ) {
            setActiveChannel(null);
        }
    }, [channels, activeChannel]);

    const handleSeed = useCallback(async () => {
        try {
            const seed = await realtimeApi.seed();
            const seeded: KnownUser[] = [
                { id: seed.alice_id, label: "Alice" },
                { id: seed.bob_id, label: "Bob" },
            ];
            setKnownUsers((prev) => {
                const merged = [...prev];
                for (const s of seeded) {
                    if (!merged.some((u) => u.id === s.id)) merged.push(s);
                }
                return merged;
            });
            if (!actingUser) setActingUser(seed.alice_id);
        } catch (e) {
            console.error("seed failed", e);
        }
    }, [actingUser]);

    const handleCreateChannel = useCallback(
        async (name: string, topic: string | null) => {
            if (!actingUser) return;
            await realtimeApi.createChannel(actingUser, name, topic);
            await refreshChannels();
        },
        [actingUser, refreshChannels]
    );

    const handleShare = useCallback(
        async (
            channelId: Uuid,
            targetUserId: Uuid,
            actions: ("ChannelsRead" | "ChannelsList" | "ChannelsPublish")[]
        ) => {
            if (!actingUser) return;
            await realtimeApi.shareChannel(
                actingUser,
                channelId,
                targetUserId,
                actions
            );
        },
        [actingUser]
    );

    const actingLabel = useMemo(
        () => knownUsers.find((u) => u.id === actingUser)?.label ?? null,
        [actingUser, knownUsers]
    );

    return (
        <div className="grid h-full grid-rows-[auto_1fr]">
            <IdentityBar
                actingUser={actingUser}
                actingLabel={actingLabel}
                knownUsers={knownUsers}
                onActingUserChange={setActingUser}
                onSeed={handleSeed}
            />
            <div className="grid h-full grid-cols-[280px_1fr] overflow-hidden">
                <RoomList
                    channels={channels}
                    activeChannelId={activeChannel?.id ?? null}
                    onSelect={setActiveChannel}
                    onCreate={handleCreateChannel}
                    onReload={refreshChannels}
                    canCreate={!!actingUser}
                />
                <main className="overflow-hidden">
                    {activeChannel && actingUser ? (
                        <ActiveRoom
                            key={activeChannel.id}
                            channel={activeChannel}
                            actingUser={actingUser}
                            knownUsers={knownUsers}
                            onShare={handleShare}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center p-12 text-muted-foreground">
                            <div className="max-w-md text-center">
                                <p className="text-lg font-medium">
                                    realtime chat
                                </p>
                                <p className="mt-2 text-sm">
                                    {actingUser
                                        ? "Pick a room from the left, or create a new one."
                                        : "Click ‘Seed Alice + Bob’ in the header to begin."}
                                </p>
                                <p className="mt-4 text-xs">
                                    Chat events ride on top of the generic
                                    realtime channels API
                                    (<code>event_kind = "chat.message"</code>).
                                </p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
