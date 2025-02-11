import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { ClusterStatus } from "../../api-client";

interface ClusterStatusCompProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly clusterStatus?: ClusterStatus;
}

interface ClusterStatusCompState {}

export default class ClusterStatusComp extends Component<
    ClusterStatusCompProps,
    ClusterStatusCompState
> {
    constructor(props: ClusterStatusCompProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`ClusterStatusComp flex flex-col${this.props.className ?? ""}`}
            >
                <span>Install state: {this.props.clusterStatus?.install_state}</span>
                <span>Running state: {this.props.clusterStatus?.running_state}</span>
            </div>
        );
    };
}
