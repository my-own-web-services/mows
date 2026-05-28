import {
    AlertCircle,
    CornerDownRight,
    Loader2,
    MoreHorizontal,
    Paperclip,
    Pencil,
    Reply,
    SmilePlus,
    Trash2
} from "lucide-react";
import {
    forwardRef,
    useCallback,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent,
    type MouseEvent
} from "react";
import { cn } from "@/lib/utils";
import Avatar from "../../identity/avatar/Avatar";
import { Button } from "../../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Textarea } from "../../ui/textarea";
import EmojiPicker from "../../input/emojiPicker/EmojiPicker";
import {
    DEFAULT_AVAILABLE_REACTIONS,
    type ChatMessage,
    type ChatStrings,
    type ChatUser
} from "./types";

interface MessageRowProps {
    readonly index: number;
    readonly message: ChatMessage;
    readonly author?: ChatUser;
    readonly currentUserId: string;
    readonly replyTo?: ChatMessage;
    readonly replyAuthor?: ChatUser;
    /** When true, hide avatar + author header (grouped with the previous row). */
    readonly grouped: boolean;
    readonly showAvatar: boolean;
    readonly strings: ChatStrings;
    readonly readOnly?: boolean;
    readonly availableReactions: ReadonlyArray<string>;
    readonly onReact?: (messageId: string, emoji: string) => void | Promise<void>;
    readonly onUnreact?: (messageId: string, emoji: string) => void | Promise<void>;
    readonly onReplyClick?: (message: ChatMessage) => void;
    readonly onEdit?: (messageId: string, body: string) => void | Promise<void>;
    readonly onDelete?: (messageId: string) => void | Promise<void>;
    readonly onRetry?: (messageId: string) => void | Promise<void>;
    readonly onClick?: (message: ChatMessage) => void;
    readonly readByLabel: string;
    readonly onMeasured: (index: number, height: number) => void;
}

const formatTime = (epochMs: number): string => {
    const d = new Date(epochMs);
    const h = d.getHours().toString().padStart(2, `0`);
    const m = d.getMinutes().toString().padStart(2, `0`);
    return `${h}:${m}`;
};

// Pull every reaction's count + whether the current user is in it. Sorting
// by count keeps the most-used reaction first; ties fall back to emoji order
// so the strip stays stable across renders.
const summariseReactions = (
    message: ChatMessage,
    currentUserId: string
): ReadonlyArray<{ readonly emoji: string; readonly count: number; readonly byMe: boolean }> => {
    const reactions = message.reactions ?? [];
    return reactions
        .filter((r) => r.userIds.length > 0)
        .map((r) => ({
            emoji: r.emoji,
            count: r.userIds.length,
            byMe: r.userIds.includes(currentUserId)
        }))
        .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.emoji.localeCompare(b.emoji)));
};

const MessageRow = forwardRef<HTMLDivElement, MessageRowProps>((props, forwardedRef) => {
    const {
        index,
        message,
        author,
        currentUserId,
        replyTo,
        replyAuthor,
        grouped,
        showAvatar,
        strings,
        readOnly,
        availableReactions,
        onReact,
        onUnreact,
        onReplyClick,
        onEdit,
        onDelete,
        onRetry,
        onClick,
        readByLabel,
        onMeasured
    } = props;

    const isMine = message.authorId === currentUserId;
    const innerRef = useRef<HTMLDivElement | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(message.body);
    const [reactionPopoverOpen, setReactionPopoverOpen] = useState(false);

    // The virtualizer needs a precise row height to lay out the next item;
    // we report whatever the row actually measures (including any inline
    // edit affordance, reaction strip, attachments) via a ResizeObserver.
    // The cache that lives on the parent uses (index → height); flushing
    // it on every change keeps subsequent rows aligned even when content
    // grows after the initial paint.
    useEffect(() => {
        const node = innerRef.current;
        if (!node) return;
        const report = () => {
            const h = node.getBoundingClientRect().height;
            if (h > 0) onMeasured(index, h);
        };
        report();
        const ro = new ResizeObserver(report);
        ro.observe(node);
        return () => ro.disconnect();
    }, [index, onMeasured, message]);

    const setRefs = useCallback(
        (node: HTMLDivElement | null) => {
            innerRef.current = node;
            if (typeof forwardedRef === `function`) {
                forwardedRef(node);
            } else if (forwardedRef) {
                forwardedRef.current = node;
            }
        },
        [forwardedRef]
    );

    const reactions = summariseReactions(message, currentUserId);

    const handleEditSubmit = useCallback(() => {
        const next = editValue.trim();
        if (next.length === 0 || next === message.body) {
            setIsEditing(false);
            setEditValue(message.body);
            return;
        }
        onEdit?.(message.id, next);
        setIsEditing(false);
    }, [editValue, message.body, message.id, onEdit]);

    const handleEditKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === `Escape`) {
            e.preventDefault();
            setIsEditing(false);
            setEditValue(message.body);
            return;
        }
        if (e.key === `Enter` && !e.shiftKey) {
            e.preventDefault();
            handleEditSubmit();
        }
    };

    const handleReactionToggle = (emoji: string) => {
        const summary = reactions.find((r) => r.emoji === emoji);
        if (summary?.byMe) {
            onUnreact?.(message.id, emoji);
        } else {
            onReact?.(message.id, emoji);
        }
    };

    const handlePickReaction = (emoji: string) => {
        handleReactionToggle(emoji);
        setReactionPopoverOpen(false);
    };

    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest(`[data-chat-action]`)) return;
        onClick?.(message);
    };

    return (
        <div
            ref={setRefs}
            role={`listitem`}
            data-testid={`chat-message`}
            data-message-id={message.id}
            data-author-id={message.authorId}
            data-pending={message.pending ? `true` : undefined}
            data-failed={message.failed ? `true` : undefined}
            data-mine={isMine ? `true` : undefined}
            data-grouped={grouped ? `true` : undefined}
            onClick={onClick ? handleClick : undefined}
            className={cn(
                `group/message relative flex w-full gap-3 px-4`,
                grouped ? `pt-0.5 pb-0.5` : `pt-3 pb-1`,
                message.failed && `bg-destructive/5`
            )}
        >
            {showAvatar && (
                <div className={`w-9 shrink-0`}>
                    {!grouped && (
                        <Avatar displayName={author?.name ?? `?`} className={`h-8 w-8`} />
                    )}
                </div>
            )}
            <div className={`flex min-w-0 flex-1 flex-col`}>
                {!grouped && (
                    <div className={`flex items-baseline gap-2`}>
                        <span className={`text-sm font-semibold`}>
                            {author?.name ?? message.authorId}
                        </span>
                        <span className={`text-muted-foreground text-xs`}>
                            {formatTime(message.createdAt)}
                        </span>
                        {message.editedAt !== undefined && (
                            <span className={`text-muted-foreground text-xs italic`}>
                                ({strings.editedLabel})
                            </span>
                        )}
                    </div>
                )}

                {replyTo && (
                    <div
                        className={cn(
                            `border-primary/40 bg-muted/40 text-muted-foreground my-1 flex max-w-md items-start gap-1 rounded-sm border-l-2 px-2 py-1 text-xs`
                        )}
                    >
                        <CornerDownRight className={`mt-0.5 h-3 w-3 shrink-0`} aria-hidden />
                        <div className={`min-w-0`}>
                            <div className={`text-foreground/70 font-medium`}>
                                {replyAuthor?.name ?? replyTo.authorId}
                            </div>
                            <div className={`truncate`}>{replyTo.body}</div>
                        </div>
                    </div>
                )}

                {isEditing ? (
                    <div className={`mt-1 flex flex-col gap-2`}>
                        <Textarea
                            data-chat-action={`edit-textarea`}
                            value={editValue}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                                setEditValue(e.target.value)
                            }
                            onKeyDown={handleEditKeyDown}
                            autoFocus
                            className={`min-h-[60px] text-sm`}
                        />
                        <div className={`flex justify-end gap-2`}>
                            <Button
                                data-chat-action={`cancel-edit`}
                                size={`sm`}
                                variant={`outline`}
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditValue(message.body);
                                }}
                            >
                                {strings.cancel}
                            </Button>
                            <Button
                                data-chat-action={`save-edit`}
                                size={`sm`}
                                onClick={handleEditSubmit}
                            >
                                {strings.save}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div
                        className={cn(
                            `text-sm whitespace-pre-wrap break-words`,
                            message.pending && `opacity-60`
                        )}
                    >
                        {message.body}
                    </div>
                )}

                {message.attachments && message.attachments.length > 0 && (
                    <ul
                        aria-label={strings.attachmentsLabel}
                        className={`mt-1 flex flex-wrap gap-2`}
                    >
                        {message.attachments.map((att) => (
                            <li key={att.id}>
                                <a
                                    href={att.url}
                                    target={`_blank`}
                                    rel={`noreferrer`}
                                    data-chat-action={`attachment`}
                                    className={`border-border bg-muted/60 hover:bg-muted flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs`}
                                >
                                    <Paperclip className={`h-3 w-3`} aria-hidden />
                                    <span className={`max-w-[200px] truncate`}>{att.name}</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                )}

                {reactions.length > 0 && (
                    <ul className={`mt-1 flex flex-wrap gap-1`}>
                        {reactions.map((r) => (
                            <li key={r.emoji}>
                                <button
                                    type={`button`}
                                    data-chat-action={`reaction-toggle`}
                                    data-emoji={r.emoji}
                                    data-by-me={r.byMe ? `true` : undefined}
                                    onClick={() => handleReactionToggle(r.emoji)}
                                    disabled={readOnly}
                                    className={cn(
                                        `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors`,
                                        r.byMe
                                            ? `border-primary/60 bg-primary/15 text-primary`
                                            : `border-border bg-muted/60 hover:bg-muted text-foreground`
                                    )}
                                >
                                    <span aria-hidden>{r.emoji}</span>
                                    <span className={`tabular-nums`}>{r.count}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {message.readBy && message.readBy.length > 0 && !grouped && (
                    <div className={`text-muted-foreground mt-0.5 text-[10px]`}>
                        {readByLabel}: {message.readBy.length}
                    </div>
                )}

                {message.pending && (
                    <div className={`text-muted-foreground mt-1 flex items-center gap-1 text-xs`}>
                        <Loader2 className={`h-3 w-3 animate-spin`} aria-hidden />
                    </div>
                )}
                {message.failed && (
                    <button
                        type={`button`}
                        data-chat-action={`retry`}
                        onClick={() => onRetry?.(message.id)}
                        className={`text-destructive mt-1 flex items-center gap-1 text-xs hover:underline`}
                    >
                        <AlertCircle className={`h-3 w-3`} aria-hidden /> {strings.sendFailed}
                    </button>
                )}
            </div>

            {!readOnly && !isEditing && (
                <div
                    className={cn(
                        `pointer-events-none absolute top-1 right-3 flex translate-y-0 items-center gap-1 rounded-md border bg-background p-0.5 opacity-0 shadow-sm transition-opacity group-hover/message:pointer-events-auto group-hover/message:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100`
                    )}
                    data-chat-action={`row-actions`}
                >
                    <Popover open={reactionPopoverOpen} onOpenChange={setReactionPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                size={`icon-xs`}
                                variant={`ghost`}
                                data-chat-action={`open-reactions`}
                                aria-label={strings.react}
                                title={strings.react}
                            >
                                <SmilePlus />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align={`end`}
                            className={`w-auto overflow-hidden p-0`}
                            data-chat-action={`reactions-popover`}
                        >
                            {(availableReactions ?? DEFAULT_AVAILABLE_REACTIONS).length > 0 && (
                                <div
                                    data-chat-action={`quick-reactions`}
                                    className={`flex gap-0.5 border-b bg-card p-1`}
                                >
                                    {(availableReactions ?? DEFAULT_AVAILABLE_REACTIONS).map(
                                        (emoji) => (
                                            <button
                                                key={emoji}
                                                type={`button`}
                                                data-chat-action={`pick-reaction`}
                                                data-emoji={emoji}
                                                onClick={() => handlePickReaction(emoji)}
                                                className={`hover:bg-accent flex h-8 w-8 items-center justify-center rounded-md text-base`}
                                            >
                                                {emoji}
                                            </button>
                                        )
                                    )}
                                </div>
                            )}
                            <EmojiPicker
                                onSelect={(emoji) => {
                                    handlePickReaction(emoji);
                                }}
                                height={320}
                                className={`border-0 shadow-none`}
                            />
                        </PopoverContent>
                    </Popover>
                    {onReplyClick && (
                        <Button
                            size={`icon-xs`}
                            variant={`ghost`}
                            data-chat-action={`reply`}
                            aria-label={strings.reply}
                            title={strings.reply}
                            onClick={() => onReplyClick(message)}
                        >
                            <Reply />
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size={`icon-xs`}
                                variant={`ghost`}
                                data-chat-action={`more`}
                                aria-label={`More`}
                            >
                                <MoreHorizontal />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={`end`}>
                            {isMine && onEdit && (
                                <DropdownMenuItem
                                    data-chat-action={`menu-edit`}
                                    onSelect={() => setIsEditing(true)}
                                >
                                    <Pencil /> {strings.edit}
                                </DropdownMenuItem>
                            )}
                            {onReplyClick && (
                                <DropdownMenuItem
                                    data-chat-action={`menu-reply`}
                                    onSelect={() => onReplyClick(message)}
                                >
                                    <Reply /> {strings.reply}
                                </DropdownMenuItem>
                            )}
                            {isMine && onDelete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        data-chat-action={`menu-delete`}
                                        className={`text-destructive focus:text-destructive`}
                                        onSelect={() => onDelete(message.id)}
                                    >
                                        <Trash2 /> {strings.delete}
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    );
});

MessageRow.displayName = `MessageRow`;

export default MessageRow;
