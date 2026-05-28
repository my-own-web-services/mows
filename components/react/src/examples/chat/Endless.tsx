import { useCallback, useMemo, useState } from "react";
import Chat from "../../../lib/components/chat/Chat/Chat";
import type {
    ChatLoadOlderResponse,
    ChatMessage,
    ChatUser
} from "../../../lib/components/chat/Chat/types";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const TOTAL = 4_000;
const PAGE = 80;

const USERS: Record<string, ChatUser> = {
    you: { id: `you`, name: `You` },
    a: { id: `a`, name: `Annika` },
    b: { id: `b`, name: `Benji` },
    c: { id: `c`, name: `Cleo` }
};

const ROTATION = [`you`, `a`, `b`, `c`] as const;

const buildMessage = (i: number): ChatMessage => {
    const authorIndex = i % ROTATION.length;
    return {
        id: `e-${i}`,
        authorId: ROTATION[authorIndex]!,
        body: `Synthetic message #${i + 1} — virtualization keeps render cost flat.`,
        createdAt: Date.now() - (TOTAL - i) * 60_000
    };
};

const INITIAL: ChatMessage[] = Array.from({ length: PAGE }, (_, k) => buildMessage(TOTAL - PAGE + k));

const Example = () => {
    const [messages, setMessages] = useState<ChatMessage[]>(INITIAL);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    useExampleState({ loaded: messages.length, hasMore });

    const loadOlder = useCallback(async (): Promise<ChatLoadOlderResponse> => {
        setLoadingOlder(true);
        await new Promise((r) => setTimeout(r, 350));
        setMessages((prev) => {
            const oldestIndex = Number(prev[0]!.id.split(`-`)[1]);
            const start = Math.max(0, oldestIndex - PAGE);
            const older = Array.from({ length: oldestIndex - start }, (_, k) =>
                buildMessage(start + k)
            );
            if (start === 0) {
                queueMicrotask(() => setHasMore(false));
            }
            return [...older, ...prev];
        });
        setLoadingOlder(false);
        return { messages: [], hasMore: true };
    }, []);

    const handleSend = useCallback((input: { body: string }) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `live-${prev.length}`,
                authorId: `you`,
                body: input.body,
                createdAt: Date.now()
            }
        ]);
    }, []);

    const wrapperStyle = useMemo(() => ({ height: `560px` }), []);

    return (
        <div className={`w-full max-w-3xl`} style={wrapperStyle}>
            <Chat
                messages={messages}
                users={USERS}
                currentUserId={`you`}
                onSend={handleSend}
                loadOlder={loadOlder}
                hasMore={hasMore}
                loadingOlder={loadingOlder}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.chat.endless,
    Example
};

export default module;
