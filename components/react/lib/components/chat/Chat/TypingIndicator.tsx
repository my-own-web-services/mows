import { cn } from "@/lib/utils";
import type { ChatStrings, ChatUser } from "./types";

interface TypingIndicatorProps {
    readonly users: ReadonlyArray<ChatUser>;
    readonly strings: Pick<ChatStrings, `typingOne` | `typingTwo` | `typingMany`>;
    readonly className?: string;
}

const renderLabel = (
    users: ReadonlyArray<ChatUser>,
    s: TypingIndicatorProps[`strings`]
): string => {
    if (users.length === 1) {
        return s.typingOne.replace(`{name}`, users[0]!.name);
    }
    if (users.length === 2) {
        return s.typingTwo.replace(`{a}`, users[0]!.name).replace(`{b}`, users[1]!.name);
    }
    return s.typingMany.replace(`{count}`, String(users.length));
};

const TypingIndicator = (props: TypingIndicatorProps) => {
    if (props.users.length === 0) return null;
    return (
        <div
            data-testid={`chat-typing-indicator`}
            className={cn(
                `text-muted-foreground flex items-center gap-2 px-4 py-1 text-xs`,
                props.className
            )}
        >
            <span className={`flex gap-0.5`} aria-hidden>
                <span className={`bg-muted-foreground/70 h-1.5 w-1.5 animate-pulse rounded-full`} />
                <span
                    className={`bg-muted-foreground/70 h-1.5 w-1.5 animate-pulse rounded-full`}
                    style={{ animationDelay: `120ms` }}
                />
                <span
                    className={`bg-muted-foreground/70 h-1.5 w-1.5 animate-pulse rounded-full`}
                    style={{ animationDelay: `240ms` }}
                />
            </span>
            <span>{renderLabel(props.users, props.strings)}</span>
        </div>
    );
};

export default TypingIndicator;
