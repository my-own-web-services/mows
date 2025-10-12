import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { PureComponent, type CSSProperties } from "react";

interface DateTimeProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly timestampMilliseconds?: number;
}

interface DateTimeState {}

export default class DateTime extends PureComponent<DateTimeProps, DateTimeState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: DateTimeProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        const formatter = new Intl.DateTimeFormat(this.context!.currentLanguage?.code, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
        return (
            <div style={{ ...this.props.style }} className={cn(`DateTime`, this.props.className)}>
                {this.props.timestampMilliseconds
                    ? formatter.format(new Date(this.props.timestampMilliseconds))
                    : ""}
            </div>
        );
    };
}
