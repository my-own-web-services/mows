import type { ChatStrings } from "./types";

interface DateDividerProps {
    readonly date: Date;
    readonly strings: Pick<ChatStrings, `today` | `yesterday`>;
}

const startOfDay = (d: Date): number => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const formatDate = (
    date: Date,
    strings: Pick<ChatStrings, `today` | `yesterday`>
): string => {
    const now = new Date();
    const today = startOfDay(now);
    const yesterday = today - 86_400_000;
    const target = startOfDay(date);
    if (target === today) return strings.today;
    if (target === yesterday) return strings.yesterday;
    return date.toLocaleDateString(undefined, {
        weekday: `long`,
        year: `numeric`,
        month: `long`,
        day: `numeric`
    });
};

const DateDivider = (props: DateDividerProps) => {
    return (
        <div
            role={`separator`}
            data-testid={`chat-date-divider`}
            className={`flex items-center gap-3 px-4 pt-4 pb-2`}
        >
            <div className={`bg-border h-px flex-1`} />
            <span className={`text-muted-foreground text-xs font-medium tracking-wide uppercase`}>
                {formatDate(props.date, props.strings)}
            </span>
            <div className={`bg-border h-px flex-1`} />
        </div>
    );
};

export default DateDivider;
