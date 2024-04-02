import { Component } from "preact";
import { IoChevronDownOutline, IoChevronForwardOutline } from "react-icons/io5";

interface CollapsibleProps {
    readonly title: JSX.Element;
    readonly iconSize?: number;
    readonly defaultOpen?: boolean;
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
            <div className="Collapsible">
                <div
                    className={"CollapsibleTitle"}
                    onClick={() => this.setState(state => ({ isOpen: !state.isOpen }))}
                >
                    {this.props.title}
                    {this.state.isOpen ? (
                        <IoChevronDownOutline size={iconSize} />
                    ) : (
                        <IoChevronForwardOutline size={iconSize} />
                    )}
                </div>
                <div>{this.state.isOpen ? this.props.children : null}</div>
            </div>
        );
    };
}
