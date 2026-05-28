import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// react-virtualized-auto-sizer reads its parent dimensions via the layout
// pipeline; jsdom reports zero, so we feed a fixed viewport in.
vi.mock(`react-virtualized-auto-sizer`, () => ({
    default: ({
        children
    }: {
        children: (size: { width: number; height: number }) => React.ReactNode;
    }) => children({ width: 800, height: 600 })
}));

import Chat from "./Chat";
import type { ChatMessage, ChatUser } from "./types";

const USERS: Record<string, ChatUser> = {
    alice: { id: `alice`, name: `Alice` },
    bob: { id: `bob`, name: `Bob` },
    carol: { id: `carol`, name: `Carol` }
};

const baseTime = new Date(`2025-06-10T10:00:00Z`).getTime();

const makeMessage = (overrides: Partial<ChatMessage>): ChatMessage => ({
    id: `m-${Math.random().toString(36).slice(2)}`,
    authorId: `alice`,
    body: `hello`,
    createdAt: baseTime,
    ...overrides
});

describe(`Chat`, () => {
    it(`renders the empty state when there are no messages`, () => {
        render(<Chat messages={[]} users={USERS} currentUserId={`alice`} />);
        expect(screen.getByTestId(`chat-empty`)).toBeInTheDocument();
    });

    it(`renders each message with author, body, and timestamp`, () => {
        const messages: ChatMessage[] = [
            makeMessage({ id: `m1`, authorId: `alice`, body: `Hi from Alice` }),
            makeMessage({
                id: `m2`,
                authorId: `bob`,
                body: `Hey Alice!`,
                createdAt: baseTime + 60_000
            })
        ];
        const { container } = render(
            <Chat messages={messages} users={USERS} currentUserId={`alice`} />
        );
        const rows = container.querySelectorAll(`[data-testid="chat-message"]`);
        expect(rows.length).toBe(2);
        expect(screen.getByText(`Hi from Alice`)).toBeInTheDocument();
        expect(screen.getByText(`Hey Alice!`)).toBeInTheDocument();
        // Each row stamps the author id for downstream styling / actions.
        expect(rows[0]).toHaveAttribute(`data-author-id`, `alice`);
        expect(rows[1]).toHaveAttribute(`data-author-id`, `bob`);
    });

    it(`stamps data-mine on rows authored by the current user`, () => {
        const messages: ChatMessage[] = [
            makeMessage({ id: `m1`, authorId: `alice`, body: `mine` }),
            makeMessage({ id: `m2`, authorId: `bob`, body: `theirs` })
        ];
        const { container } = render(
            <Chat messages={messages} users={USERS} currentUserId={`alice`} />
        );
        const mine = container.querySelector(`[data-message-id="m1"]`);
        const theirs = container.querySelector(`[data-message-id="m2"]`);
        expect(mine).toHaveAttribute(`data-mine`, `true`);
        expect(theirs).not.toHaveAttribute(`data-mine`);
    });

    it(`inserts date dividers between messages from different days`, () => {
        const messages: ChatMessage[] = [
            makeMessage({ id: `d1`, body: `yesterday`, createdAt: baseTime }),
            makeMessage({
                id: `d2`,
                body: `today`,
                createdAt: baseTime + 86_400_000 * 2
            })
        ];
        const { container } = render(
            <Chat
                messages={messages}
                users={USERS}
                currentUserId={`alice`}
                showDateDividers
            />
        );
        const dividers = container.querySelectorAll(`[data-testid="chat-date-divider"]`);
        // One divider preceding each day -> two dividers for two distinct days.
        expect(dividers.length).toBe(2);
    });

    it(`omits the dividers when showDateDividers is false`, () => {
        const messages: ChatMessage[] = [
            makeMessage({ id: `n1`, body: `a`, createdAt: baseTime }),
            makeMessage({
                id: `n2`,
                body: `b`,
                createdAt: baseTime + 86_400_000 * 2
            })
        ];
        const { container } = render(
            <Chat
                messages={messages}
                users={USERS}
                currentUserId={`alice`}
                showDateDividers={false}
            />
        );
        expect(container.querySelectorAll(`[data-testid="chat-date-divider"]`).length).toBe(0);
    });

    it(`groups consecutive messages from the same author within the window`, () => {
        const messages: ChatMessage[] = [
            makeMessage({ id: `g1`, authorId: `alice`, body: `1`, createdAt: baseTime }),
            makeMessage({
                id: `g2`,
                authorId: `alice`,
                body: `2`,
                createdAt: baseTime + 60_000
            }),
            makeMessage({
                id: `g3`,
                authorId: `bob`,
                body: `3`,
                createdAt: baseTime + 120_000
            })
        ];
        const { container } = render(
            <Chat
                messages={messages}
                users={USERS}
                currentUserId={`alice`}
                groupConsecutiveMessages
                showDateDividers={false}
            />
        );
        const g2 = container.querySelector(`[data-message-id="g2"]`);
        const g3 = container.querySelector(`[data-message-id="g3"]`);
        expect(g2).toHaveAttribute(`data-grouped`, `true`);
        // Author changes between g2 and g3 — grouping must reset.
        expect(g3).not.toHaveAttribute(`data-grouped`);
    });

    it(`sends the typed body and clears the composer on Enter`, async () => {
        const onSend = vi.fn();
        render(
            <Chat
                messages={[]}
                users={USERS}
                currentUserId={`alice`}
                onSend={onSend}
            />
        );
        const input = screen.getByTestId(`chat-composer-input`) as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: `Hello world` } });
        await act(async () => {
            fireEvent.keyDown(input, { key: `Enter` });
        });
        expect(onSend).toHaveBeenCalledTimes(1);
        expect(onSend).toHaveBeenCalledWith({ body: `Hello world`, replyToId: undefined });
        expect(input.value).toBe(``);
    });

    it(`does not send on Shift+Enter (line break instead)`, () => {
        const onSend = vi.fn();
        render(
            <Chat
                messages={[]}
                users={USERS}
                currentUserId={`alice`}
                onSend={onSend}
            />
        );
        const input = screen.getByTestId(`chat-composer-input`) as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: `line` } });
        fireEvent.keyDown(input, { key: `Enter`, shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();
    });

    it(`does not allow sending empty messages`, () => {
        const onSend = vi.fn();
        render(
            <Chat
                messages={[]}
                users={USERS}
                currentUserId={`alice`}
                onSend={onSend}
            />
        );
        const sendButton = screen.getByTestId(`chat-composer-send`);
        expect(sendButton).toBeDisabled();
        const input = screen.getByTestId(`chat-composer-input`) as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: `   ` } });
        fireEvent.keyDown(input, { key: `Enter` });
        expect(onSend).not.toHaveBeenCalled();
    });

    it(`hides the composer when readOnly is true`, () => {
        render(
            <Chat
                messages={[makeMessage({ id: `r1` })]}
                users={USERS}
                currentUserId={`alice`}
                readOnly
                onSend={vi.fn()}
            />
        );
        expect(screen.queryByTestId(`chat-composer-input`)).not.toBeInTheDocument();
    });

    it(`enforces maxBodyLength on the composer input`, () => {
        render(
            <Chat
                messages={[]}
                users={USERS}
                currentUserId={`alice`}
                onSend={vi.fn()}
                maxBodyLength={5}
            />
        );
        const input = screen.getByTestId(`chat-composer-input`) as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: `abcdefgh` } });
        expect(input.value).toBe(`abcde`);
        expect(screen.getByTestId(`chat-composer-counter`)).toHaveTextContent(`5 / 5`);
    });

    it(`renders reaction chips and toggles via onReact / onUnreact`, () => {
        const onReact = vi.fn();
        const onUnreact = vi.fn();
        const messages: ChatMessage[] = [
            makeMessage({
                id: `r1`,
                authorId: `bob`,
                body: `tada`,
                reactions: [
                    { emoji: `🎉`, userIds: [`alice`, `bob`] },
                    { emoji: `👍`, userIds: [`bob`] }
                ]
            })
        ];
        const { container } = render(
            <Chat
                messages={messages}
                users={USERS}
                currentUserId={`alice`}
                onReact={onReact}
                onUnreact={onUnreact}
            />
        );
        const chips = Array.from(
            container.querySelectorAll<HTMLButtonElement>(
                `[data-chat-action="reaction-toggle"]`
            )
        );
        // Two distinct emojis -> two chips. The first (sorted by count) is the tada with 2 users.
        expect(chips.length).toBe(2);
        const tada = chips.find((c) => c.dataset.emoji === `🎉`)!;
        expect(tada).toHaveAttribute(`data-by-me`, `true`);
        fireEvent.click(tada);
        expect(onUnreact).toHaveBeenCalledWith(`r1`, `🎉`);
        expect(onReact).not.toHaveBeenCalled();
        const thumbs = chips.find((c) => c.dataset.emoji === `👍`)!;
        fireEvent.click(thumbs);
        expect(onReact).toHaveBeenCalledWith(`r1`, `👍`);
    });

    it(`shows a reply preview in the composer when reply is invoked`, async () => {
        const onSend = vi.fn();
        const original = makeMessage({ id: `o1`, authorId: `bob`, body: `original` });
        const { container } = render(
            <Chat
                messages={[original]}
                users={USERS}
                currentUserId={`alice`}
                onSend={onSend}
            />
        );
        // The reply button is hidden until hover but still present in the DOM —
        // CSS opacity transitions don't gate it.
        const replyBtn = container.querySelector(`[data-chat-action="reply"]`)!;
        fireEvent.click(replyBtn);
        expect(screen.getByTestId(`chat-composer-reply`)).toBeInTheDocument();
        // Sending should carry replyToId.
        const input = screen.getByTestId(`chat-composer-input`) as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: `replying` } });
        await act(async () => {
            fireEvent.keyDown(input, { key: `Enter` });
        });
        expect(onSend).toHaveBeenCalledWith({ body: `replying`, replyToId: `o1` });
    });

    it(`renders the in-reply-to badge on a message that points to another`, () => {
        const original = makeMessage({ id: `t1`, authorId: `bob`, body: `original text` });
        const reply = makeMessage({
            id: `t2`,
            authorId: `alice`,
            body: `reply text`,
            replyToId: `t1`,
            createdAt: baseTime + 60_000
        });
        const { container } = render(
            <Chat messages={[original, reply]} users={USERS} currentUserId={`alice`} />
        );
        const replyRow = container.querySelector(`[data-message-id="t2"]`)!;
        expect(within(replyRow as HTMLElement).getByText(`original text`)).toBeInTheDocument();
    });

    it(`shows the typing indicator with the typing user's name`, () => {
        render(
            <Chat
                messages={[]}
                users={USERS}
                currentUserId={`alice`}
                typingUserIds={[`bob`]}
            />
        );
        const indicator = screen.getByTestId(`chat-typing-indicator`);
        expect(indicator).toHaveTextContent(`Bob is typing…`);
    });

    it(`omits the current user from the typing indicator`, () => {
        render(
            <Chat
                messages={[]}
                users={USERS}
                currentUserId={`alice`}
                typingUserIds={[`alice`, `bob`]}
            />
        );
        expect(screen.getByTestId(`chat-typing-indicator`)).toHaveTextContent(
            `Bob is typing…`
        );
    });

    it(`renders the failed-send retry affordance and calls onRetry`, () => {
        const onRetry = vi.fn();
        const messages: ChatMessage[] = [
            makeMessage({ id: `f1`, authorId: `alice`, body: `broken`, failed: true })
        ];
        const { container } = render(
            <Chat
                messages={messages}
                users={USERS}
                currentUserId={`alice`}
                onRetry={onRetry}
            />
        );
        const retry = container.querySelector(`[data-chat-action="retry"]`)!;
        fireEvent.click(retry);
        expect(onRetry).toHaveBeenCalledWith(`f1`);
    });

    it(`calls loadOlder when the list mounts near the top with hasMore`, async () => {
        const loadOlder = vi.fn(() => Promise.resolve({ messages: [], hasMore: false }));
        render(
            <Chat
                messages={[makeMessage({ id: `o-1` })]}
                users={USERS}
                currentUserId={`alice`}
                loadOlder={loadOlder}
                hasMore
            />
        );
        // The VariableSizeList fires onItemsRendered on first paint; the
        // scrollTop is 0 (jsdom default) so loadOlder is allowed to fire.
        await act(async () => {
            await Promise.resolve();
        });
        expect(loadOlder).toHaveBeenCalled();
    });

    it(`shows the older-messages banner when hasMore is true`, () => {
        render(
            <Chat
                messages={[makeMessage({ id: `b1` })]}
                users={USERS}
                currentUserId={`alice`}
                hasMore
            />
        );
        expect(screen.getByTestId(`chat-older-banner`)).toBeInTheDocument();
    });
});
