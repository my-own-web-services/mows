import { useMemo } from "react";
import Chat from "../../../lib/components/chat/Chat/Chat";
import type {
    ChatMessage,
    ChatUser
} from "../../../lib/components/chat/Chat/types";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const USERS: Record<string, ChatUser> = {
    you: { id: `you`, name: `You` },
    incident: { id: `incident`, name: `incident-bot` },
    ops: { id: `ops`, name: `On-call · Sven` }
};

const NOW = Date.now();

const TRANSCRIPT: ChatMessage[] = [
    {
        id: `r1`,
        authorId: `incident`,
        body: `PagerDuty: api-gateway latency p99 above 800ms for 5m.`,
        createdAt: NOW - 60 * 60_000
    },
    {
        id: `r2`,
        authorId: `ops`,
        body: `Ack. Looking at the canary first.`,
        createdAt: NOW - 58 * 60_000,
        readBy: [`you`]
    },
    {
        id: `r3`,
        authorId: `ops`,
        body: `Canary is fine — rolling back the most recent deploy to be safe.`,
        createdAt: NOW - 56 * 60_000,
        readBy: [`you`, `incident`]
    },
    {
        id: `r4`,
        authorId: `incident`,
        body: `Rollback acknowledged. Latency back under 300ms.`,
        createdAt: NOW - 51 * 60_000,
        reactions: [{ emoji: `🎉`, userIds: [`ops`, `you`] }]
    }
];

const Example = () => {
    useExampleState({ readOnly: true, messageCount: TRANSCRIPT.length });
    const wrapperStyle = useMemo(() => ({ height: `420px` }), []);
    return (
        <div className={`w-full max-w-2xl`} style={wrapperStyle}>
            <Chat
                messages={TRANSCRIPT}
                users={USERS}
                currentUserId={`you`}
                readOnly
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.chat.readOnly,
    Example
};

export default module;
