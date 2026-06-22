import { FileText, Mic, Paperclip, Send, Smile, Square, X } from "lucide-react";
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import EmojiPicker from "../../input/emojiPicker/EmojiPicker";
import type {
    ChatAttachmentKind,
    ChatMessage,
    ChatSendInput,
    ChatStrings,
    ChatUser
} from "./types";

interface ComposerProps {
    readonly strings: ChatStrings;
    readonly placeholder?: string;
    readonly maxBodyLength?: number;
    readonly disabled?: boolean;
    readonly replyTo?: ChatMessage;
    readonly replyAuthor?: ChatUser;
    readonly onCancelReply?: () => void;
    readonly onSend: (input: ChatSendInput) => void | Promise<void>;
    /** Opt-in: paperclip button to stage file attachments. */
    readonly enableAttachments?: boolean;
    /** Opt-in: microphone button to record a voice message. */
    readonly enableVoice?: boolean;
    /** Opt-in: emoji button that opens the full EmojiPicker and inserts at the caret. */
    readonly enableEmojiPicker?: boolean;
    /** Per-file size guard (bytes); staging refuses larger files. */
    readonly maxAttachmentBytes?: number;
}

export interface ComposerHandle {
    readonly focus: () => void;
    readonly clear: () => void;
}

interface StagedFile {
    readonly id: string;
    readonly file: File;
    readonly url: string;
    readonly kind: ChatAttachmentKind;
}

const kindOf = (mime: string): ChatAttachmentKind => {
    if (mime.startsWith(`image/`)) return `image`;
    if (mime.startsWith(`video/`)) return `video`;
    if (mime.startsWith(`audio/`)) return `voice`;
    return `file`;
};

// Match the container the MediaRecorder picked so the filename extension is
// sensible (m4a/ogg/webm).
const voiceFilename = (mime: string): string => {
    if (mime.includes(`mp4`)) return `voice-message.m4a`;
    if (mime.includes(`ogg`)) return `voice-message.ogg`;
    return `voice-message.webm`;
};

const Composer = forwardRef<ComposerHandle, ComposerProps>((props, ref) => {
    const {
        strings,
        placeholder,
        maxBodyLength,
        disabled,
        replyTo,
        replyAuthor,
        onCancelReply,
        onSend,
        enableAttachments,
        enableVoice,
        enableEmojiPicker,
        maxAttachmentBytes
    } = props;
    const [value, setValue] = useState(``);
    const [staged, setStaged] = useState<ReadonlyArray<StagedFile>>([]);
    const [recording, setRecording] = useState(false);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [error, setError] = useState(``);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const idRef = useRef(0);
    // Keep the latest staged list for cleanup on unmount.
    const stagedRef = useRef<ReadonlyArray<StagedFile>>([]);
    stagedRef.current = staged;
    useEffect(() => () => stagedRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

    useImperativeHandle(ref, () => ({
        focus: () => textareaRef.current?.focus(),
        clear: () => {
            setValue(``);
            setStaged((prev) => {
                prev.forEach((s) => URL.revokeObjectURL(s.url));
                return [];
            });
        }
    }));

    const stageFile = useCallback(
        (file: File) => {
            if (maxAttachmentBytes !== undefined && file.size > maxAttachmentBytes) {
                setError(strings.attachmentTooLarge);
                return;
            }
            setError(``);
            setStaged((prev) => [
                ...prev,
                {
                    id: `${idRef.current++}`,
                    file,
                    url: URL.createObjectURL(file),
                    kind: kindOf(file.type)
                }
            ]);
        },
        [maxAttachmentBytes, strings.attachmentTooLarge]
    );

    const handleFilesChosen = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = ``;
        files.forEach(stageFile);
    };

    const removeStaged = (id: string) => {
        setStaged((prev) => {
            const item = prev.find((s) => s.id === id);
            if (item) URL.revokeObjectURL(item.url);
            return prev.filter((s) => s.id !== id);
        });
    };

    const toggleRecording = async () => {
        if (recording) {
            recorderRef.current?.stop();
            return;
        }
        setError(``);
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            setError(strings.microphoneUnavailable);
            return;
        }
        const mime = [`audio/webm;codecs=opus`, `audio/webm`, `audio/mp4`].find((m) =>
            MediaRecorder.isTypeSupported(m)
        );
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (ev) => {
            if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            setRecording(false);
            const type = recorder.mimeType || `audio/webm`;
            const blob = new Blob(chunks, { type });
            if (blob.size > 0) {
                stageFile(new File([blob], voiceFilename(type), { type }));
            }
        };
        recorderRef.current = recorder;
        recorder.start();
        setRecording(true);
    };

    const submit = useCallback(async () => {
        if (recording) return;
        const body = value.trim();
        const files = staged.map((s) => s.file);
        if (body.length === 0 && files.length === 0) return;
        await onSend({
            body,
            replyToId: replyTo?.id,
            files: files.length > 0 ? files : undefined
        });
        setValue(``);
        setStaged((prev) => {
            prev.forEach((s) => URL.revokeObjectURL(s.url));
            return [];
        });
    }, [onSend, recording, replyTo?.id, staged, value]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === `Enter` && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
            return;
        }
        if (e.key === `Escape` && replyTo && onCancelReply) {
            e.preventDefault();
            onCancelReply();
        }
    };

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const next = e.target.value;
        if (maxBodyLength !== undefined && next.length > maxBodyLength) {
            setValue(next.slice(0, maxBodyLength));
            return;
        }
        setValue(next);
    };

    // Insert a picked emoji at the caret (or replacing the selection), then
    // restore focus + caret just after it so users can keep typing / picking.
    const insertEmoji = useCallback(
        (emoji: string) => {
            setValue((current) => {
                const ta = textareaRef.current;
                const start = ta?.selectionStart ?? current.length;
                const end = ta?.selectionEnd ?? current.length;
                const next = current.slice(0, start) + emoji + current.slice(end);
                if (maxBodyLength !== undefined && next.length > maxBodyLength) return current;
                requestAnimationFrame(() => {
                    const pos = start + emoji.length;
                    ta?.focus();
                    try {
                        ta?.setSelectionRange(pos, pos);
                    } catch {
                        // setSelectionRange can throw on a detached node — ignore.
                    }
                });
                return next;
            });
        },
        [maxBodyLength]
    );

    const nothingToSend = value.trim().length === 0 && staged.length === 0;

    return (
        <div className={`border-border bg-background flex flex-col gap-1 border-t px-3 py-2`}>
            {replyTo && (
                <div
                    data-testid={`chat-composer-reply`}
                    className={`bg-muted/50 text-muted-foreground flex items-center justify-between rounded-md px-2 py-1 text-xs`}
                >
                    <span className={`min-w-0 truncate`}>
                        <span className={`text-foreground/70 font-medium`}>
                            {strings.replyingTo} {replyAuthor?.name ?? replyTo.authorId}:
                        </span>{` `}
                        <span className={`truncate`}>{replyTo.body}</span>
                    </span>
                    <Button
                        size={`icon-xs`}
                        variant={`ghost`}
                        onClick={onCancelReply}
                        aria-label={strings.cancel}
                        data-testid={`chat-composer-cancel-reply`}
                    >
                        <X />
                    </Button>
                </div>
            )}

            {error && <div className={`text-destructive px-1 text-xs`}>{error}</div>}

            {staged.length > 0 && (
                <div
                    data-testid={`chat-composer-staged`}
                    className={`flex flex-wrap items-center gap-2 py-1`}
                >
                    {staged.map((item) => (
                        <div key={item.id} className={`relative`}>
                            {item.kind === `image` && (
                                <img
                                    src={item.url}
                                    alt={item.file.name}
                                    className={`border-border size-16 rounded-md border object-cover`}
                                />
                            )}
                            {item.kind === `video` && (
                                <video
                                    src={item.url}
                                    className={`border-border size-16 rounded-md border object-cover`}
                                />
                            )}
                            {item.kind === `voice` && (
                                <audio src={item.url} controls className={`h-10 max-w-[200px]`} />
                            )}
                            {item.kind === `file` && (
                                <div
                                    className={`border-border bg-muted/50 flex max-w-44 items-center gap-2 rounded-md border px-2.5 py-2`}
                                >
                                    <FileText className={`size-5 shrink-0`} aria-hidden />
                                    <span className={`truncate text-xs`}>{item.file.name}</span>
                                </div>
                            )}
                            <Button
                                type={`button`}
                                variant={`secondary`}
                                size={`icon-xs`}
                                onClick={() => removeStaged(item.id)}
                                aria-label={strings.removeAttachment}
                                className={`border-border absolute -top-1.5 -right-1.5 size-5 rounded-full border shadow-sm`}
                            >
                                <X className={`size-3`} />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <div className={`flex items-end gap-2`}>
                {enableAttachments && (
                    <>
                        <input
                            ref={fileInputRef}
                            type={`file`}
                            multiple
                            hidden
                            onChange={handleFilesChosen}
                            data-testid={`chat-composer-file-input`}
                        />
                        <Button
                            type={`button`}
                            variant={`ghost`}
                            size={`icon`}
                            disabled={disabled || recording}
                            onClick={() => fileInputRef.current?.click()}
                            aria-label={strings.attachFiles}
                            title={strings.attachFiles}
                            data-testid={`chat-composer-attach`}
                        >
                            <Paperclip />
                        </Button>
                    </>
                )}
                {enableVoice && (
                    <Button
                        type={`button`}
                        variant={recording ? `destructive` : `ghost`}
                        size={`icon`}
                        disabled={disabled}
                        onClick={() => void toggleRecording()}
                        aria-label={recording ? strings.stopRecording : strings.recordVoice}
                        title={recording ? strings.stopRecording : strings.recordVoice}
                        data-testid={`chat-composer-record`}
                    >
                        {recording ? <Square /> : <Mic />}
                    </Button>
                )}
                {enableEmojiPicker && (
                    <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                type={`button`}
                                variant={`ghost`}
                                size={`icon`}
                                disabled={disabled || recording}
                                aria-label={strings.insertEmoji}
                                title={strings.insertEmoji}
                                data-testid={`chat-composer-emoji`}
                            >
                                <Smile />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align={`start`}
                            side={`top`}
                            className={`w-auto border-none p-0 shadow-none`}
                            data-testid={`chat-composer-emoji-popover`}
                        >
                            {/* Stays open across picks so several emoji can be
                                inserted in one go; closes on Escape / outside. */}
                            <EmojiPicker onSelect={insertEmoji} onClose={() => setEmojiOpen(false)} />
                        </PopoverContent>
                    </Popover>
                )}
                <Textarea
                    ref={textareaRef}
                    data-testid={`chat-composer-input`}
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder={recording ? strings.recording : placeholder ?? strings.inputPlaceholder}
                    disabled={disabled || recording}
                    className={cn(`max-h-40 min-h-[40px] resize-none flex-1`)}
                    aria-label={placeholder ?? strings.inputPlaceholder}
                />
                <Button
                    type={`button`}
                    onClick={() => void submit()}
                    disabled={disabled || recording || nothingToSend}
                    size={`icon`}
                    data-testid={`chat-composer-send`}
                    aria-label={strings.sendButton}
                    title={strings.sendButton}
                >
                    <Send />
                </Button>
            </div>
            <div
                className={`text-muted-foreground flex items-center justify-between px-1 text-[10px]`}
            >
                <span>{strings.composerHint}</span>
                {maxBodyLength !== undefined && (
                    <span data-testid={`chat-composer-counter`} className={`tabular-nums`}>
                        {value.length} / {maxBodyLength}
                    </span>
                )}
            </div>
        </div>
    );
});

Composer.displayName = `Composer`;

export default Composer;
