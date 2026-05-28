import { useCallback, useMemo, useState } from "react";
import Chat from "../../../lib/components/chat/Chat/Chat";
import type {
    ChatMessage,
    ChatSendInput,
    ChatUser
} from "../../../lib/components/chat/Chat/types";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const USERS: Record<string, ChatUser> = {
    you: { id: `you`, name: `أنت` },
    layla: { id: `layla`, name: `ليلى` },
    omar: { id: `omar`, name: `عمر` }
};

const NOW = Date.now();

const SEED: ChatMessage[] = [
    {
        id: `r-1`,
        authorId: `layla`,
        body: `صباح الخير! هل اطلعتم على رسائل أمس؟`,
        createdAt: NOW - 30 * 60_000
    },
    {
        id: `r-2`,
        authorId: `omar`,
        body: `نعم، سأرد بعد قليل.`,
        createdAt: NOW - 28 * 60_000,
        reactions: [{ emoji: `👍`, userIds: [`layla`] }]
    },
    {
        id: `r-3`,
        authorId: `you`,
        body: `جيد، شكراً لكما.`,
        createdAt: NOW - 5 * 60_000
    }
];

const Example = () => {
    const [messages, setMessages] = useState<ChatMessage[]>(SEED);
    useExampleState({ direction: `rtl` });

    const handleSend = useCallback((input: ChatSendInput) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `live-${prev.length}`,
                authorId: `you`,
                body: input.body,
                replyToId: input.replyToId,
                createdAt: Date.now()
            }
        ]);
    }, []);

    const wrapperStyle = useMemo(() => ({ height: `420px` }), []);

    return (
        <div dir={`rtl`} className={`w-full max-w-2xl`} style={wrapperStyle}>
            <Chat
                messages={messages}
                users={USERS}
                currentUserId={`you`}
                onSend={handleSend}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.chat.rtl,
    Example
};

export default module;
