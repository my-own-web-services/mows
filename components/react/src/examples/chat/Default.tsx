import { useCallback, useMemo, useState } from "react";
import Chat from "../../../lib/components/chat/Chat/Chat";
import type {
    ChatMessage,
    ChatReaction,
    ChatSendInput,
    ChatUser
} from "../../../lib/components/chat/Chat/types";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const USERS: Record<string, ChatUser> = {
    you: { id: `you`, name: `You` },
    iris: { id: `iris`, name: `Iris Park` },
    rohan: { id: `rohan`, name: `Rohan Lee` },
    mara: { id: `mara`, name: `Mara Schmidt` }
};

const DAY = 86_400_000;
const NOW = Date.now();

const SEED: ChatMessage[] = [
    {
        id: `s1`,
        authorId: `iris`,
        body: `Morning! Did anyone get a chance to look at the new design tokens?`,
        createdAt: NOW - DAY - 3_600_000
    },
    {
        id: `s2`,
        authorId: `rohan`,
        body: `Glanced over them — the surface palette is much calmer now 👌`,
        createdAt: NOW - DAY - 3_500_000,
        reactions: [{ emoji: `👍`, userIds: [`iris`, `mara`] }]
    },
    {
        id: `s3`,
        authorId: `mara`,
        body: `Replying to the surface palette: do we still have an "elevated" variant? I needed one for tooltips yesterday.`,
        createdAt: NOW - DAY - 3_400_000,
        replyToId: `s2`
    },
    {
        id: `s4`,
        authorId: `iris`,
        body: `Yeah — popover-elevated is what you want. I'll add a note in the spec.`,
        createdAt: NOW - DAY - 3_390_000
    },
    {
        id: `s5`,
        authorId: `you`,
        body: `Quick aside — I pushed a draft of the chat surface, virtualized with react-window.`,
        createdAt: NOW - 60 * 60 * 1000
    },
    {
        id: `s6`,
        authorId: `rohan`,
        body: `Oh nice, scrolls fast?`,
        createdAt: NOW - 59 * 60 * 1000
    },
    {
        id: `s7`,
        authorId: `you`,
        body: `Yeah, 10k synthetic messages stay smooth. Reactions and threading are in.`,
        createdAt: NOW - 58 * 60 * 1000,
        reactions: [{ emoji: `🎉`, userIds: [`iris`, `rohan`, `mara`] }]
    }
];

const Example = () => {
    const [messages, setMessages] = useState<ChatMessage[]>(SEED);
    useExampleState({ messageCount: messages.length });

    const handleSend = useCallback((input: ChatSendInput) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `m-${prev.length + 1}-${Date.now()}`,
                authorId: `you`,
                body: input.body,
                replyToId: input.replyToId,
                createdAt: Date.now()
            }
        ]);
    }, []);

    const handleReact = useCallback((messageId: string, emoji: string) => {
        setMessages((prev) =>
            prev.map((m) => {
                if (m.id !== messageId) return m;
                const reactions = m.reactions ? m.reactions.map((r) => ({ ...r, userIds: [...r.userIds] })) : [];
                const existing = reactions.find((r) => r.emoji === emoji);
                if (existing) {
                    if (!existing.userIds.includes(`you`)) existing.userIds.push(`you`);
                } else {
                    reactions.push({ emoji, userIds: [`you`] });
                }
                return { ...m, reactions };
            })
        );
    }, []);

    const handleUnreact = useCallback((messageId: string, emoji: string) => {
        setMessages((prev) =>
            prev.map((m) => {
                if (m.id !== messageId) return m;
                const reactions = (m.reactions ?? [])
                    .map((r) =>
                        r.emoji === emoji
                            ? { ...r, userIds: r.userIds.filter((u) => u !== `you`) }
                            : r
                    )
                    .filter((r): r is ChatReaction => r.userIds.length > 0);
                return { ...m, reactions };
            })
        );
    }, []);

    const handleEdit = useCallback((messageId: string, body: string) => {
        setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, body, editedAt: Date.now() } : m))
        );
    }, []);

    const handleDelete = useCallback((messageId: string) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }, []);

    const wrapperStyle = useMemo(() => ({ height: `560px` }), []);

    return (
        <div className={`w-full max-w-3xl`} style={wrapperStyle}>
            <Chat
                messages={messages}
                users={USERS}
                currentUserId={`you`}
                onSend={handleSend}
                onReact={handleReact}
                onUnreact={handleUnreact}
                onEdit={handleEdit}
                onDelete={handleDelete}
                typingUserIds={[`iris`]}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.chat.default,
    Example
};

export default module;
