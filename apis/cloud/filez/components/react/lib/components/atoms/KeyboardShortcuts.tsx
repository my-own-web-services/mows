import { cn } from "@/lib/utils";
import { type CSSProperties, PureComponent } from "react";

interface KeyboardShortcutsProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface KeyboardShortcutsState {}

export default class KeyboardShortcuts extends PureComponent<
    KeyboardShortcutsProps,
    KeyboardShortcutsState
> {
    constructor(props: KeyboardShortcutsProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`KeyboardShortcuts`, this.props.className)}
            ></div>
        );
    };
}
