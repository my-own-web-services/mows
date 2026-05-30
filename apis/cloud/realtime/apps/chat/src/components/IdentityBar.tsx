import { Button } from "@my-own-web-services/react-components/components/ui/button";
import type { Uuid } from "../lib/realtimeApi";

interface KnownUser {
    id: Uuid;
    label: string;
}

interface IdentityBarProps {
    readonly actingUser: Uuid | null;
    readonly actingLabel: string | null;
    readonly knownUsers: KnownUser[];
    readonly onActingUserChange: (id: Uuid | null) => void;
    readonly onSeed: () => void;
}

export default function IdentityBar({
    actingUser,
    actingLabel,
    knownUsers,
    onActingUserChange,
    onSeed,
}: IdentityBarProps) {
    return (
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
            <h1 className="text-base font-semibold">realtime chat</h1>
            <span className="text-xs text-muted-foreground">
                events on top of the realtime API
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted-foreground">acting as</label>
                <select
                    value={actingUser ?? ""}
                    onChange={(e) => onActingUserChange(e.target.value || null)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    aria-label="Acting user"
                >
                    <option value="">(anonymous)</option>
                    {knownUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.label}  ({u.id.slice(0, 8)}…)
                        </option>
                    ))}
                </select>
                {actingLabel && (
                    <span className="text-xs text-muted-foreground">
                        signed in as <strong>{actingLabel}</strong>
                    </span>
                )}
                <Button size="sm" variant="outline" onClick={onSeed}>
                    Seed Alice + Bob
                </Button>
            </div>
        </header>
    );
}
