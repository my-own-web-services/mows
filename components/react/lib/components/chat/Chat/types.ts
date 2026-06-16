import type { CSSProperties, ReactNode } from "react";

export interface ChatUser {
    readonly id: string;
    readonly name: string;
    readonly avatarUrl?: string;
}

export interface ChatReaction {
    readonly emoji: string;
    readonly userIds: ReadonlyArray<string>;
}

export type ChatAttachmentKind = `image` | `video` | `voice` | `file`;

export type ChatTranscriptStatus = `pending` | `done` | `failed`;

export interface ChatAttachment {
    readonly id: string;
    readonly name: string;
    readonly url: string;
    readonly mimeType?: string;
    readonly size?: number;
    /**
     * Explicit media kind. When omitted it is derived from `mimeType`
     * (image/* → image, video/* → video, audio/* → voice, else file).
     * Drives rich rendering: image/video render inline with a full-screen
     * lightbox, voice renders an audio player + transcript.
     */
    readonly kind?: ChatAttachmentKind;
    /** Optional thumbnail/poster URL for image/video previews. */
    readonly thumbnailUrl?: string;
    /** Transcript text for a voice attachment (shown under the player). */
    readonly transcript?: string | null;
    /** Transcription lifecycle for a voice attachment. */
    readonly transcriptStatus?: ChatTranscriptStatus | null;
}

export interface ChatMessage {
    readonly id: string;
    readonly authorId: string;
    readonly body: string;
    /** Epoch milliseconds. */
    readonly createdAt: number;
    /** Epoch milliseconds. Presence implies the message was edited. */
    readonly editedAt?: number;
    /** The id of the message this is a reply to. */
    readonly replyToId?: string;
    readonly reactions?: ReadonlyArray<ChatReaction>;
    readonly attachments?: ReadonlyArray<ChatAttachment>;
    /** Optimistic state: render with reduced opacity + spinner. */
    readonly pending?: boolean;
    /** Send failed — render with destructive styling + retry affordance. */
    readonly failed?: boolean;
    /** User ids of viewers that have seen this message; used for receipts. */
    readonly readBy?: ReadonlyArray<string>;
    /** Free-form metadata kept opaque by the component. */
    readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatLoadOlderResponse {
    readonly messages: ReadonlyArray<ChatMessage>;
    readonly hasMore: boolean;
}

export interface ChatSendInput {
    readonly body: string;
    readonly replyToId?: string;
    /** Already-uploaded attachments (have a URL). */
    readonly attachments?: ReadonlyArray<ChatAttachment>;
    /**
     * Raw files staged in the composer that still need uploading. The
     * consumer's `onSend` is responsible for uploading them (with `body`
     * as the optional caption). Present only when `enableAttachments` /
     * `enableVoice` are set.
     */
    readonly files?: ReadonlyArray<File>;
}

export interface ChatProps {
    /** The full ordered list of messages, oldest first. */
    readonly messages: ReadonlyArray<ChatMessage>;
    /** Lookup of user id → user. Author rendering reads from here. */
    readonly users: Readonly<Record<string, ChatUser>>;
    /** The id of the user currently viewing the chat. */
    readonly currentUserId: string;
    /**
     * Called when the user scrolls near the top of the message list.
     * Should resolve with older messages (which the consumer is
     * responsible for prepending to `messages`).
     */
    readonly loadOlder?: () => Promise<ChatLoadOlderResponse> | void;
    /** True when more messages exist above the loaded window. */
    readonly hasMore?: boolean;
    /** Drives the top-of-list loading spinner. */
    readonly loadingOlder?: boolean;
    /** User ids that are currently typing (excluding `currentUserId`). */
    readonly typingUserIds?: ReadonlyArray<string>;
    readonly onSend?: (input: ChatSendInput) => void | Promise<void>;
    readonly onEdit?: (messageId: string, body: string) => void | Promise<void>;
    readonly onDelete?: (messageId: string) => void | Promise<void>;
    readonly onReact?: (messageId: string, emoji: string) => void | Promise<void>;
    readonly onUnreact?: (messageId: string, emoji: string) => void | Promise<void>;
    readonly onRetry?: (messageId: string) => void | Promise<void>;
    readonly onMessageClick?: (message: ChatMessage) => void;
    /** Disables the composer + per-message action menu. */
    readonly readOnly?: boolean;
    /** Hide avatars / display-name labels and collapse to a compact list. */
    readonly showAvatars?: boolean;
    /** Insert a sticky day divider between messages from different days. */
    readonly showDateDividers?: boolean;
    /**
     * When true, consecutive messages from the same author within a
     * short window collapse their author header / avatar so the rows
     * read as a single "burst" — like Slack / Discord do.
     */
    readonly groupConsecutiveMessages?: boolean;
    /** Quick-pick emoji set rendered in the reaction popover. */
    readonly availableReactions?: ReadonlyArray<string>;
    /** Maximum characters the composer accepts before refusing input. */
    readonly maxBodyLength?: number;
    /** Rendered when `messages` is empty. */
    readonly emptyState?: ReactNode;
    /** Number of items kept rendered outside the viewport for smoother scroll. */
    readonly overscanCount?: number;
    readonly inputPlaceholder?: string;
    /**
     * Partial override of the built-in UI strings (merged over
     * DEFAULT_CHAT_STRINGS). Use for localisation.
     */
    readonly strings?: Partial<ChatStrings>;
    /**
     * Render extra content for a message, below its body/attachments —
     * e.g. a custom card driven by `message.metadata` (offer/invoice, a
     * link preview, …). Return null to render nothing.
     */
    readonly renderMessageExtra?: (message: ChatMessage) => ReactNode;
    /**
     * Opt-in: let the composer stage file attachments. Staged files are
     * surfaced as raw `File`s on `ChatSendInput.files` so the consumer can
     * upload them; `body` doubles as the caption.
     */
    readonly enableAttachments?: boolean;
    /** Opt-in: let the composer record a voice message (MediaRecorder). */
    readonly enableVoice?: boolean;
    /** Per-attachment upload size limit in bytes (composer staging guard). */
    readonly maxAttachmentBytes?: number;
    readonly className?: string;
    readonly style?: CSSProperties;
}

export interface ChatStrings {
    readonly sendButton: string;
    readonly inputPlaceholder: string;
    readonly cancel: string;
    readonly save: string;
    readonly edit: string;
    readonly delete: string;
    readonly reply: string;
    readonly react: string;
    readonly retry: string;
    readonly editedLabel: string;
    readonly replyingTo: string;
    readonly typingOne: string;
    readonly typingTwo: string;
    readonly typingMany: string;
    readonly loadingOlder: string;
    readonly noMore: string;
    readonly newMessages: string;
    readonly emptyTitle: string;
    readonly emptyDescription: string;
    readonly today: string;
    readonly yesterday: string;
    readonly attachmentsLabel: string;
    readonly readByLabel: string;
    readonly composerHint: string;
    readonly sendFailed: string;
    // Rich media (inline attachments, lightbox, voice transcript, composer).
    readonly transcribing: string;
    readonly transcriptUnavailable: string;
    readonly openPreview: string;
    readonly closePreview: string;
    readonly downloadOriginal: string;
    readonly attachFiles: string;
    readonly recordVoice: string;
    readonly stopRecording: string;
    readonly recording: string;
    readonly removeAttachment: string;
    readonly attachmentTooLarge: string;
    readonly microphoneUnavailable: string;
}

export const DEFAULT_CHAT_STRINGS: ChatStrings = {
    sendButton: `Send`,
    inputPlaceholder: `Write a message…`,
    cancel: `Cancel`,
    save: `Save`,
    edit: `Edit`,
    delete: `Delete`,
    reply: `Reply`,
    react: `React`,
    retry: `Retry`,
    editedLabel: `edited`,
    replyingTo: `Replying to`,
    typingOne: `{name} is typing…`,
    typingTwo: `{a} and {b} are typing…`,
    typingMany: `{count} people are typing…`,
    loadingOlder: `Loading older messages…`,
    noMore: `Beginning of conversation`,
    newMessages: `New messages — jump to latest`,
    emptyTitle: `No messages yet`,
    emptyDescription: `Be the first to write something.`,
    today: `Today`,
    yesterday: `Yesterday`,
    attachmentsLabel: `Attachments`,
    readByLabel: `Read by`,
    composerHint: `Enter to send · Shift+Enter for newline`,
    sendFailed: `Couldn't send — click to retry`,
    transcribing: `Transcribing…`,
    transcriptUnavailable: `Transcription unavailable.`,
    openPreview: `Open preview`,
    closePreview: `Close`,
    downloadOriginal: `Download original`,
    attachFiles: `Attach files`,
    recordVoice: `Record voice message`,
    stopRecording: `Stop recording`,
    recording: `Recording…`,
    removeAttachment: `Remove attachment`,
    attachmentTooLarge: `File is too large.`,
    microphoneUnavailable: `Microphone unavailable.`
};

export const DEFAULT_AVAILABLE_REACTIONS: ReadonlyArray<string> = [
    `👍`,
    `❤️`,
    `😂`,
    `🎉`,
    `🤔`,
    `😢`,
    `🔥`,
    `👀`
];
