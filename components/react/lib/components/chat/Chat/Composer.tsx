import { Send, X } from "lucide-react";
import {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import type { ChatMessage, ChatSendInput, ChatStrings, ChatUser } from "./types";

interface ComposerProps {
    readonly strings: ChatStrings;
    readonly placeholder?: string;
    readonly maxBodyLength?: number;
    readonly disabled?: boolean;
    readonly replyTo?: ChatMessage;
    readonly replyAuthor?: ChatUser;
    readonly onCancelReply?: () => void;
    readonly onSend: (input: ChatSendInput) => void | Promise<void>;
}

export interface ComposerHandle {
    readonly focus: () => void;
    readonly clear: () => void;
}

const Composer = forwardRef<ComposerHandle, ComposerProps>((props, ref) => {
    const { strings, placeholder, maxBodyLength, disabled, replyTo, replyAuthor, onCancelReply, onSend } = props;
    const [value, setValue] = useState(``);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => ({
        focus: () => textareaRef.current?.focus(),
        clear: () => setValue(``)
    }));

    const submit = useCallback(async () => {
        const body = value.trim();
        if (body.length === 0) return;
        await onSend({ body, replyToId: replyTo?.id });
        setValue(``);
    }, [onSend, replyTo?.id, value]);

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
            <div className={`flex items-end gap-2`}>
                <Textarea
                    ref={textareaRef}
                    data-testid={`chat-composer-input`}
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder={placeholder ?? strings.inputPlaceholder}
                    disabled={disabled}
                    className={cn(`max-h-40 min-h-[40px] resize-none flex-1`)}
                    aria-label={placeholder ?? strings.inputPlaceholder}
                />
                <Button
                    type={`button`}
                    onClick={() => void submit()}
                    disabled={disabled || value.trim().length === 0}
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
