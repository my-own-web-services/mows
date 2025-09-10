import { Component } from "preact";
import { CSSProperties } from "preact/compat";

interface AppNewProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AppNewState {}

export default class AppNew extends Component<AppNewProps, AppNewState> {
    constructor(props: AppNewProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`AppNew ${this.props.className ?? ""}`}
            ></div>
        );
    };
}
