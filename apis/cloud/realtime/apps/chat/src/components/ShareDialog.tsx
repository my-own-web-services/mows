import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@my-own-web-services/react-components/components/ui/dialog";
import { Button } from "@my-own-web-services/react-components/components/ui/button";
import { Checkbox } from "@my-own-web-services/react-components/components/ui/checkbox";
import { Label } from "@my-own-web-services/react-components/components/ui/label";
import type { Uuid } from "../lib/realtimeApi";

interface KnownUser {
    id: Uuid;
    label: string;
}

interface ShareDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly channelName: string;
    readonly knownUsers: KnownUser[];
    readonly actingUser: Uuid;
    readonly onConfirm: (
        targetUserId: Uuid,
        actions: ("ChannelsRead" | "ChannelsList" | "ChannelsPublish")[]
    ) => Promise<void>;
}

export default function ShareDialog({
    open,
    onOpenChange,
    channelName,
    knownUsers,
    actingUser,
    onConfirm,
}: ShareDialogProps) {
    // Default the target to the first known user that isn't the
    // acting user — saves an extra click when there are only two.
    const initialTarget =
        knownUsers.find((u) => u.id !== actingUser)?.id ?? "";
    const [targetUserId, setTargetUserId] = useState<Uuid>(initialTarget);
    const [grantRead, setGrantRead] = useState(true);
    const [grantPublish, setGrantPublish] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!targetUserId) {
            setError("Pick a user");
            return;
        }
        const actions: ("ChannelsRead" | "ChannelsList" | "ChannelsPublish")[] = [];
        if (grantRead) {
            // The Read checkbox label is explicit that both
            // ChannelsRead + ChannelsList are granted — without
            // ChannelsList the grantee can read the room but never
            // see it appear in their sidebar (review B2 / SEC-4).
            actions.push("ChannelsRead");
            actions.push("ChannelsList");
        }
        if (grantPublish) actions.push("ChannelsPublish");
        if (actions.length === 0) {
            setError("Grant at least one action");
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onConfirm(targetUserId, actions);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share #{channelName}</DialogTitle>
                    <DialogDescription>
                        Grant another user permission to read and / or
                        publish in this room. Backed by a single
                        access_policies row.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-2">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="share-user">User</Label>
                        <select
                            id="share-user"
                            value={targetUserId}
                            onChange={(e) => setTargetUserId(e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                            <option value="">Select a user…</option>
                            {knownUsers
                                .filter((u) => u.id !== actingUser)
                                .map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.label}  ({u.id.slice(0, 8)}…)
                                    </option>
                                ))}
                        </select>
                    </div>

                    <fieldset className="flex flex-col gap-2">
                        <legend className="text-sm font-medium">Actions</legend>
                        <Label
                            htmlFor="grant-read"
                            className="flex items-start gap-2 text-sm font-normal"
                        >
                            <Checkbox
                                id="grant-read"
                                checked={grantRead}
                                onCheckedChange={(v) => setGrantRead(v === true)}
                                className="mt-0.5"
                            />
                            <span>
                                ChannelsRead + ChannelsList (subscribe, read
                                history, and let the room appear in their
                                sidebar)
                            </span>
                        </Label>
                        <Label
                            htmlFor="grant-publish"
                            className="flex items-start gap-2 text-sm font-normal"
                        >
                            <Checkbox
                                id="grant-publish"
                                checked={grantPublish}
                                onCheckedChange={(v) =>
                                    setGrantPublish(v === true)
                                }
                                className="mt-0.5"
                            />
                            <span>ChannelsPublish (send messages)</span>
                        </Label>
                    </fieldset>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button onClick={() => void handleSubmit()} disabled={submitting}>
                        {submitting ? "Granting…" : "Grant"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
