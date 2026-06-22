import { ArrowDown, Loader2 } from "lucide-react";
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState
} from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { VariableSizeList, type ListOnItemsRenderedProps } from "react-window";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import Composer, { type ComposerHandle } from "./Composer";
import DateDivider from "./DateDivider";
import { MediaLightbox, type LightboxSource } from "./media";
import MessageRow from "./MessageRow";
import TypingIndicator from "./TypingIndicator";
import {
    DEFAULT_AVAILABLE_REACTIONS,
    DEFAULT_CHAT_STRINGS,
    type ChatMessage,
    type ChatProps,
    type ChatSendInput,
    type ChatUser
} from "./types";

interface MessageRowItem {
    readonly kind: `message`;
    readonly message: ChatMessage;
    readonly index: number;
    /** Same author as the previous message and within the grouping window. */
    readonly grouped: boolean;
}

interface DateDividerItem {
    readonly kind: `divider`;
    readonly date: Date;
}

type RenderRow = MessageRowItem | DateDividerItem;

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const NEAR_TOP_TRIGGER_PX = 80;
const NEAR_BOTTOM_TRIGGER_PX = 60;
const DEFAULT_ROW_HEIGHT = 68;
const DEFAULT_DIVIDER_HEIGHT = 36;

const sameDay = (a: number, b: number): boolean => {
    const da = new Date(a);
    const db = new Date(b);
    return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate()
    );
};

const buildRenderRows = (
    messages: ReadonlyArray<ChatMessage>,
    showDateDividers: boolean,
    groupConsecutiveMessages: boolean
): ReadonlyArray<RenderRow> => {
    const rows: RenderRow[] = [];
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]!;
        const prev = messages[i - 1];
        if (showDateDividers && (i === 0 || !sameDay(prev!.createdAt, msg.createdAt))) {
            rows.push({ kind: `divider`, date: new Date(msg.createdAt) });
        }
        // A message is "grouped" with the previous one (no avatar / header)
        // when it shares an author *and* it falls within a short window;
        // any inserted date divider breaks the burst, since visually they
        // belong on different days.
        const lastRow = rows[rows.length - 1];
        const groupedWithPrev =
            groupConsecutiveMessages &&
            prev !== undefined &&
            prev.authorId === msg.authorId &&
            msg.createdAt - prev.createdAt < GROUP_WINDOW_MS &&
            lastRow !== undefined &&
            lastRow.kind === `message`;
        rows.push({ kind: `message`, message: msg, index: i, grouped: groupedWithPrev });
    }
    return rows;
};

export interface ChatHandle {
    /** Focus the composer textarea. */
    readonly focus: () => void;
    /** Scroll the message list to the most recent message. */
    readonly scrollToBottom: () => void;
}

const Chat = forwardRef<ChatHandle, ChatProps>((props, ref) => {
    const {
        messages,
        users,
        currentUserId,
        loadOlder,
        hasMore,
        loadingOlder,
        typingUserIds,
        onSend,
        onEdit,
        onDelete,
        onReact,
        onUnreact,
        onRetry,
        onMessageClick,
        readOnly,
        showAvatars = true,
        showDateDividers = true,
        groupConsecutiveMessages = true,
        availableReactions = DEFAULT_AVAILABLE_REACTIONS,
        maxBodyLength,
        emptyState,
        overscanCount = 6,
        inputPlaceholder,
        strings: stringsProp,
        renderMessageExtra,
        enableAttachments,
        enableVoice,
        enableEmojiPicker,
        maxAttachmentBytes,
        className,
        style
    } = props;

    const strings = useMemo(
        () => ({ ...DEFAULT_CHAT_STRINGS, ...stringsProp }),
        [stringsProp]
    );
    const [lightbox, setLightbox] = useState<LightboxSource | null>(null);

    const renderRows = useMemo(
        () => buildRenderRows(messages, showDateDividers, groupConsecutiveMessages),
        [messages, showDateDividers, groupConsecutiveMessages]
    );

    // Variable-size virtualization needs a per-row pixel height. We seed
    // it with the row's category default and let the row component
    // upgrade the cached value via `onMeasured` once it has actually
    // rendered (see MessageRow's ResizeObserver). Re-rendering after a
    // measurement update needs `resetAfterIndex` so react-window
    // recomputes offsets for everything below.
    const sizeMapRef = useRef<Map<string, number>>(new Map());
    const listRef = useRef<VariableSizeList | null>(null);
    const composerRef = useRef<ComposerHandle | null>(null);
    const outerScrollRef = useRef<HTMLDivElement | null>(null);
    const isLoadingOlderRef = useRef(false);
    const stickyBottomRef = useRef(true);
    const [stickyBottom, setStickyBottom] = useState(true);
    const [replyTo, setReplyTo] = useState<ChatMessage | undefined>(undefined);
    const [pendingNewCount, setPendingNewCount] = useState(0);
    const lastMessageCountRef = useRef(messages.length);
    const lastLatestIdRef = useRef<string | undefined>(messages[messages.length - 1]?.id);

    const rowKey = useCallback((row: RenderRow): string => {
        if (row.kind === `divider`) return `d:${row.date.getTime()}`;
        return `m:${row.message.id}`;
    }, []);

    const getItemSize = useCallback(
        (index: number): number => {
            const row = renderRows[index];
            if (!row) return DEFAULT_ROW_HEIGHT;
            const cached = sizeMapRef.current.get(rowKey(row));
            if (cached !== undefined) return cached;
            return row.kind === `divider` ? DEFAULT_DIVIDER_HEIGHT : DEFAULT_ROW_HEIGHT;
        },
        [renderRows, rowKey]
    );

    const setMeasured = useCallback(
        (key: string, height: number) => {
            const current = sizeMapRef.current.get(key);
            if (current === height) return;
            sizeMapRef.current.set(key, height);
            const idx = renderRows.findIndex((r) => rowKey(r) === key);
            if (idx >= 0 && listRef.current) {
                listRef.current.resetAfterIndex(idx);
                // Re-anchor after a row's height settles (e.g. image/video
                // metadata loaded late, growing the row) so the newest message
                // stays visible. Gate on the LIVE scroll position, not the
                // sticky flag: once the user has scrolled up we must not yank
                // them back down (which would also fight manual scrolling while
                // rows are still being measured).
                const outer = outerScrollRef.current;
                if (
                    outer &&
                    outer.scrollHeight - outer.scrollTop - outer.clientHeight <
                        NEAR_BOTTOM_TRIGGER_PX
                ) {
                    // Raw scrollTop (not scrollToItem, which uses estimated
                    // sizes and lands short with variable-height media rows).
                    outer.scrollTop = outer.scrollHeight;
                }
            }
        },
        [renderRows, rowKey]
    );

    const scrollToBottom = useCallback(() => {
        if (renderRows.length === 0) return;
        // Prefer the raw scroll position: scrollToItem computes an offset from
        // ESTIMATED row sizes and lands short of the true bottom when rows have
        // not been measured yet (images/videos). Setting scrollTop to the full
        // height pins to the actual bottom; the re-anchor in setMeasured keeps
        // it there as late media heights settle.
        const outer = outerScrollRef.current;
        if (outer) outer.scrollTop = outer.scrollHeight;
        else listRef.current?.scrollToItem(renderRows.length - 1, `end`);
        stickyBottomRef.current = true;
        setStickyBottom(true);
        setPendingNewCount(0);
    }, [renderRows.length]);

    useImperativeHandle(
        ref,
        () => ({
            focus: () => composerRef.current?.focus(),
            scrollToBottom
        }),
        [scrollToBottom]
    );

    // Track whether the latest tail has changed. If we're still pinned to
    // the bottom we stay there; otherwise we accumulate a counter so the
    // "new messages" pill knows how many the user missed.
    useEffect(() => {
        const prevCount = lastMessageCountRef.current;
        const newestId = messages[messages.length - 1]?.id;
        const newestChanged = newestId !== lastLatestIdRef.current;
        const grew = messages.length > prevCount;
        lastMessageCountRef.current = messages.length;
        lastLatestIdRef.current = newestId;
        if (!grew && !newestChanged) return;
        if (stickyBottomRef.current) {
            // Defer the scroll one tick so the VariableSizeList sees the
            // new itemCount before we call scrollToItem.
            requestAnimationFrame(() => scrollToBottom());
        } else if (grew) {
            const added = messages.length - prevCount;
            setPendingNewCount((c) => c + Math.max(1, added));
        }
    }, [messages, scrollToBottom]);

    // Load one older page if allowed and not already in flight. Triggered from
    // BOTH the top-of-list render (onItemsRendered) and continuously while
    // scrolling near the top (onScroll) so long back-paging keeps loading —
    // onItemsRendered alone stops firing once the rendered range is stable. The
    // `await` only blocks if the consumer returns a Promise; then the latch
    // sequences pages so each load uses the freshly-prepended oldest cursor.
    const maybeLoadOlder = useCallback(async () => {
        if (!loadOlder) return;
        if (hasMore === false) return;
        if (loadingOlder || isLoadingOlderRef.current) return;
        const outer = outerScrollRef.current;
        if (outer && outer.scrollTop > NEAR_TOP_TRIGGER_PX) return;
        isLoadingOlderRef.current = true;
        try {
            await loadOlder();
        } finally {
            isLoadingOlderRef.current = false;
        }
    }, [hasMore, loadOlder, loadingOlder]);

    const handleScroll = useCallback(() => {
        const outer = outerScrollRef.current;
        if (!outer) return;
        const distanceFromBottom = outer.scrollHeight - outer.scrollTop - outer.clientHeight;
        const atBottom = distanceFromBottom < NEAR_BOTTOM_TRIGGER_PX;
        if (atBottom !== stickyBottomRef.current) {
            stickyBottomRef.current = atBottom;
            setStickyBottom(atBottom);
            if (atBottom) setPendingNewCount(0);
        }
        // Keep loading older pages while the user scrolls up (not pinned to the
        // bottom) near the top — reliable trigger even when onItemsRendered
        // goes quiet on a stable range.
        if (!stickyBottomRef.current && outer.scrollTop <= NEAR_TOP_TRIGGER_PX) {
            void maybeLoadOlder();
        }
    }, [maybeLoadOlder]);

    const handleItemsRendered = useCallback(
        (info: ListOnItemsRenderedProps) => {
            if (info.visibleStartIndex > 3) return;
            void maybeLoadOlder();
        },
        [maybeLoadOlder]
    );

    const handleSend = useCallback(
        async (input: ChatSendInput) => {
            if (!onSend) return;
            await onSend(input);
            setReplyTo(undefined);
            // The caller is expected to push the new message into
            // `messages`; the auto-scroll effect above takes care of
            // pinning the viewport. We also pre-emptively re-enable
            // sticky-bottom so a user who hits Send from above the
            // fold jumps to their own message.
            stickyBottomRef.current = true;
            setStickyBottom(true);
        },
        [onSend]
    );

    const typingUsers: ReadonlyArray<ChatUser> = useMemo(() => {
        return (typingUserIds ?? [])
            .filter((id) => id !== currentUserId)
            .map((id) => users[id])
            .filter((u): u is ChatUser => u !== undefined);
    }, [currentUserId, typingUserIds, users]);

    const isEmpty = messages.length === 0;

    const renderRow = useCallback(
        ({ index, style: rowStyle }: { index: number; style: React.CSSProperties }) => {
            const row = renderRows[index]!;
            const key = rowKey(row);
            if (row.kind === `divider`) {
                return (
                    <div style={rowStyle} key={key}>
                        <div
                            ref={(node) => {
                                if (!node) return;
                                const h = node.getBoundingClientRect().height;
                                if (h > 0) setMeasured(key, h);
                            }}
                        >
                            <DateDivider
                                date={row.date}
                                strings={{ today: strings.today, yesterday: strings.yesterday }}
                            />
                        </div>
                    </div>
                );
            }
            const author = users[row.message.authorId];
            const replyTarget = row.message.replyToId
                ? messages.find((m) => m.id === row.message.replyToId)
                : undefined;
            const replyAuth = replyTarget ? users[replyTarget.authorId] : undefined;
            return (
                <div style={rowStyle} key={key}>
                    <MessageRow
                        index={row.index}
                        message={row.message}
                        author={author}
                        currentUserId={currentUserId}
                        replyTo={replyTarget}
                        replyAuthor={replyAuth}
                        grouped={row.grouped}
                        showAvatar={showAvatars}
                        strings={strings}
                        readOnly={readOnly}
                        availableReactions={availableReactions}
                        onReact={onReact}
                        onUnreact={onUnreact}
                        onReplyClick={onSend ? setReplyTo : undefined}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onRetry={onRetry}
                        onClick={onMessageClick}
                        onOpenMedia={setLightbox}
                        renderMessageExtra={renderMessageExtra}
                        readByLabel={strings.readByLabel}
                        onMeasured={(_idx, height) => setMeasured(key, height)}
                    />
                </div>
            );
        },
        [
            availableReactions,
            currentUserId,
            messages,
            onDelete,
            onEdit,
            onMessageClick,
            onReact,
            onRetry,
            onSend,
            onUnreact,
            readOnly,
            renderMessageExtra,
            renderRows,
            rowKey,
            setMeasured,
            showAvatars,
            strings,
            users
        ]
    );

    return (
        <div
            data-testid={`chat`}
            className={cn(
                `Chat bg-card text-card-foreground relative flex h-full w-full flex-col overflow-hidden rounded-md border`,
                className
            )}
            style={style}
        >
            <div className={`relative flex-1 overflow-hidden`}>
                {isEmpty ? (
                    <div
                        data-testid={`chat-empty`}
                        className={`text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1 p-6 text-center`}
                    >
                        {emptyState ?? (
                            <>
                                <div className={`text-foreground text-sm font-semibold`}>
                                    {strings.emptyTitle}
                                </div>
                                <div className={`text-xs`}>{strings.emptyDescription}</div>
                            </>
                        )}
                    </div>
                ) : (
                    <AutoSizer>
                        {({ height, width }) => (
                            <VariableSizeList
                                ref={listRef}
                                outerRef={outerScrollRef}
                                height={height}
                                width={width}
                                itemCount={renderRows.length}
                                itemSize={getItemSize}
                                overscanCount={overscanCount}
                                onScroll={handleScroll}
                                onItemsRendered={handleItemsRendered}
                                itemKey={(index) => rowKey(renderRows[index]!)}
                            >
                                {renderRow}
                            </VariableSizeList>
                        )}
                    </AutoSizer>
                )}
                {(hasMore || loadingOlder) && !isEmpty && (
                    <div
                        data-testid={`chat-older-banner`}
                        className={`pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-1`}
                    >
                        <div
                            className={`bg-background/90 text-muted-foreground flex items-center gap-2 rounded-full border px-3 py-1 text-xs shadow-sm`}
                        >
                            {loadingOlder ? (
                                <>
                                    <Loader2 className={`h-3 w-3 animate-spin`} aria-hidden />
                                    {strings.loadingOlder}
                                </>
                            ) : (
                                strings.noMore
                            )}
                        </div>
                    </div>
                )}
                {!stickyBottom && pendingNewCount > 0 && (
                    <Button
                        data-testid={`chat-jump-to-latest`}
                        variant={`default`}
                        size={`sm`}
                        className={`absolute right-4 bottom-3 shadow-md`}
                        onClick={scrollToBottom}
                    >
                        <ArrowDown />
                        {pendingNewCount > 1
                            ? `${pendingNewCount} ${strings.newMessages}`
                            : strings.newMessages}
                    </Button>
                )}
            </div>

            <TypingIndicator
                users={typingUsers}
                strings={{
                    typingOne: strings.typingOne,
                    typingTwo: strings.typingTwo,
                    typingMany: strings.typingMany
                }}
            />

            {!readOnly && onSend && (
                <Composer
                    ref={composerRef}
                    strings={strings}
                    placeholder={inputPlaceholder}
                    maxBodyLength={maxBodyLength}
                    replyTo={replyTo}
                    replyAuthor={replyTo ? users[replyTo.authorId] : undefined}
                    onCancelReply={() => setReplyTo(undefined)}
                    onSend={handleSend}
                    enableAttachments={enableAttachments}
                    enableVoice={enableVoice}
                    enableEmojiPicker={enableEmojiPicker}
                    maxAttachmentBytes={maxAttachmentBytes}
                />
            )}

            <MediaLightbox
                source={lightbox}
                onClose={() => setLightbox(null)}
                closeLabel={strings.closePreview}
                downloadLabel={strings.downloadOriginal}
            />
        </div>
    );
});

Chat.displayName = `Chat`;

export default Chat;
