import { useState } from "react";
import { Button } from "@my-own-web-services/react-components/components/ui/button";
import { Input } from "@my-own-web-services/react-components/components/ui/input";
import { cn } from "../lib/cn";
import type { Channel } from "../lib/realtimeApi";

interface RoomListProps {
    readonly channels: Channel[] | null;
    readonly activeChannelId: string | null;
    readonly onSelect: (channel: Channel) => void;
    readonly onCreate: (name: string, topic: string | null) => Promise<void>;
    readonly onReload: () => void;
    readonly canCreate: boolean;
}

export default function RoomList({
    channels,
    activeChannelId,
    onSelect,
    onCreate,
    onReload,
    canCreate,
}: RoomListProps) {
    const [newName, setNewName] = useState("");
    const [newTopic, setNewTopic] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitCreate = async () => {
        const name = newName.trim();
        if (!name) return;
        setCreating(true);
        setError(null);
        try {
            await onCreate(name, newTopic.trim() || null);
            setNewName("");
            setNewTopic("");
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setCreating(false);
        }
    };

    return (
        <aside className="flex h-full flex-col overflow-hidden border-r border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <h2 className="text-sm font-semibold">Rooms</h2>
                <Button size="sm" variant="ghost" onClick={onReload}>
                    Refresh
                </Button>
            </div>

            <div className="flex flex-col gap-1 overflow-y-auto p-2">
                {channels === null && (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                        Loading…
                    </p>
                )}
                {channels && channels.length === 0 && (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                        No rooms visible to you yet.
                    </p>
                )}
                {channels?.map((ch) => {
                    const active = ch.id === activeChannelId;
                    return (
                        <button
                            key={ch.id}
                            type="button"
                            onClick={() => onSelect(ch)}
                            className={cn(
                                "rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                                active
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : "hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <div>{ch.name}</div>
                            {ch.topic && (
                                <div
                                    className={cn(
                                        "truncate text-xs",
                                        active
                                            ? "text-primary-foreground/80"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {ch.topic}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-auto border-t border-border p-3">
                <div className="flex flex-col gap-2">
                    <Input
                        placeholder="new room name"
                        value={newName}
                        disabled={!canCreate || creating}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void submitCreate();
                        }}
                    />
                    <Input
                        placeholder="topic (optional)"
                        value={newTopic}
                        disabled={!canCreate || creating}
                        onChange={(e) => setNewTopic(e.target.value)}
                    />
                    <Button
                        size="sm"
                        disabled={!canCreate || creating || !newName.trim()}
                        onClick={() => void submitCreate()}
                    >
                        {creating ? "Creating…" : "Create room"}
                    </Button>
                    {error && (
                        <p className="text-xs text-destructive">{error}</p>
                    )}
                </div>
            </div>
        </aside>
    );
}
