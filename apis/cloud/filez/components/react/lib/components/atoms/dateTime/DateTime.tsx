import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { PureComponent, type CSSProperties } from "react";

interface DateTimeProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly timestampMilliseconds?: number;
    readonly dateTimeNaive?: string;
    readonly utcTime?: boolean;
}

type DateTimeState = Record<string, never>;

export default class DateTime extends PureComponent<DateTimeProps, DateTimeState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: DateTimeProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        // Always format in the user's local timezone
        const formatter = new Intl.DateTimeFormat(this.context!.currentLanguage?.code, {
            year: `numeric`,
            month: `2-digit`,
            day: `2-digit`,
            hour: `2-digit`,
            minute: `2-digit`,
            second: `2-digit`
        });

        let dateToFormat: Date | undefined;

        if (this.props.timestampMilliseconds) {
            // Timestamps are always UTC-based
            dateToFormat = new Date(this.props.timestampMilliseconds);
        } else if (this.props.dateTimeNaive) {
            if (this.props.utcTime) {
                // Input is UTC time: append 'Z' to ensure it's parsed as UTC
                const dateString = this.props.dateTimeNaive.endsWith(`Z`)
                    ? this.props.dateTimeNaive
                    : `${this.props.dateTimeNaive}Z`;
                dateToFormat = new Date(dateString);
            } else {
                // Input is local time: parse as-is
                dateToFormat = new Date(this.props.dateTimeNaive);
            }
        }

        return (
            <div style={{ ...this.props.style }} className={cn(`DateTime`, this.props.className)}>
                {dateToFormat && formatter.format(dateToFormat)}
            </div>
        );
    };
}
