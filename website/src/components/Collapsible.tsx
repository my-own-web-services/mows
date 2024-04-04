import { Component } from "preact";
import { IoChevronDownOutline, IoChevronForwardOutline } from "react-icons/io5";

interface CollapsibleProps {
    readonly title: JSX.Element;
    readonly iconSize?: number;
    readonly defaultOpen?: boolean;
    readonly disabled?: boolean;
    readonly style?: React.CSSProperties;
    readonly className?: string;
}
interface CollapsibleState {
    readonly isOpen: boolean;
}
export default class Collapsible extends Component<CollapsibleProps, CollapsibleState> {
    constructor(props: CollapsibleProps) {
        super(props);
        this.state = { isOpen: props.defaultOpen || false };
    }

    render = () => {
        const iconSize = this.props.iconSize || 28;
        return (
            <div
                key={this.props.key}
                className={`Collapsible ${this.props.className}`}
                style={this.props.style}
            >
                <div
                    className={`CollapsibleTitle ${this.state.isOpen ? "open" : "closed"}`}
                    style={{
                        cursor: this.props.disabled === true ? "text" : "pointer"
                    }}
                    onClick={() =>
                        this.props.disabled !== true &&
                        this.setState(state => ({ isOpen: !state.isOpen }))
                    }
                >
                    {this.props.title}
                    {this.props.disabled === true ? null : this.state.isOpen ? (
                        <IoChevronDownOutline size={iconSize} />
                    ) : (
                        <IoChevronForwardOutline size={iconSize} />
                    )}
                </div>
                <div className={"CollapsibleContent"}>
                    {this.state.isOpen ? this.props.children : null}
                </div>
            </div>
        );
    };
}
