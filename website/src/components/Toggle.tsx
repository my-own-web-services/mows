import { Component } from "preact";
import { CSSProperties } from "preact/compat";

interface ToggleProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly onClick?: () => void;
    readonly checked: boolean;
    readonly title?: string;
}

interface ToggleState {}

export default class Toggle extends Component<ToggleProps, ToggleState> {
    constructor(props: ToggleProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                title={this.props.title}
                className={`Toggle ${this.props.className ?? ""}`}
            >
                <label class="inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        value=""
                        class="sr-only peer"
                        onClick={this.props.onClick}
                        checked={this.props.checked}
                    />
                    <div class="relative w-11 h-6 bg-backgroundLighter peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-primary after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-primary after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent2"></div>
                    <span class="ms-3 text-sm font-medium ">{this.props.children}</span>
                </label>
            </div>
        );
    };
}
