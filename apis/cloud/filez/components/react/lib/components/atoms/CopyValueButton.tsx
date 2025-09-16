import { CSSProperties, PureComponent } from "react";
import { IoCheckmarkSharp, IoCopySharp } from "react-icons/io5";

interface CopyValueButtonProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly value: string;
    readonly label: string;
    readonly title?: string;
}

interface CopyValueButtonState {
    copied: boolean;
}

export default class CopyValueButton extends PureComponent<
    CopyValueButtonProps,
    CopyValueButtonState
> {
    private timeoutId: NodeJS.Timeout | null = null;

    constructor(props: CopyValueButtonProps) {
        super(props);
        this.state = {
            copied: false
        };
    }

    componentDidMount = async () => {};

    componentWillUnmount = () => {
        // Clean up timeout if component unmounts
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    };

    copyClick = async () => {
        try {
            await navigator.clipboard.writeText(this.props.value);

            this.setState({ copied: true });

            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }

            this.timeoutId = setTimeout(() => {
                this.setState({ copied: false });
                this.timeoutId = null;
            }, 1500);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    };

    render = () => {
        const { copied } = this.state;

        return (
            <button
                style={{ ...this.props.style }}
                className={`CopyValueButton ${this.props.className ?? ""} text-muted-foreground flex cursor-pointer items-center gap-2 rounded text-sm transition-all duration-200 select-none`}
                onClick={this.copyClick}
                title={copied ? "Copied!" : (this.props.title ?? this.props.label ?? "Copy Value")}
            >
                <span>{this.props.label}</span>
                {copied ? (
                    <IoCheckmarkSharp className="text-success duration-200" />
                ) : (
                    <IoCopySharp />
                )}
            </button>
        );
    };
}
