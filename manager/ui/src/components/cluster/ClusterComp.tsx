import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { VscDebugStart, VscDebugStop, VscSync } from "react-icons/vsc";
import { Button } from "rsuite";
import { Api, Cluster, ClusterSignal } from "../../api-client";
import { clusterStatusSignal } from "../../config";
import ClusterStatusComp from "./ClusterStatusComp";

interface ClusterCompProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly cluster: Cluster;
    readonly client: Api<unknown>;
}

interface ClusterCompState {}

export default class ClusterComp extends Component<ClusterCompProps, ClusterCompState> {
    constructor(props: ClusterCompProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    private signalCluster = async (signal: ClusterSignal) => {
        await this.props.client.api.signalCluster({
            cluster_id: this.props.cluster.id,
            signal: signal
        });
    };

    render = () => {
        const cluster = this.props.cluster;
        const buttonSize = "sm";
        return (
            <div
                style={{ ...this.props.style }}
                className={`ClusterComp w-full h-32${this.props.className ?? ""}`}
            >
                <h1 className={"flex items-center gap-2 pb-1 text-xl"}>
                    <span className={""}>{cluster.id}</span>
                </h1>
                <div className="flex gap-2 pt-2">
                    <Button
                        title="Start"
                        size={buttonSize}
                        onClick={() => this.signalCluster(ClusterSignal.Start)}
                    >
                        <VscDebugStart />
                    </Button>
                    <Button
                        title="Stop"
                        size={buttonSize}
                        onClick={() => this.signalCluster(ClusterSignal.Stop)}
                    >
                        <VscDebugStop />
                    </Button>
                    <Button
                        title="Restart"
                        size={buttonSize}
                        onClick={() => this.signalCluster(ClusterSignal.Restart)}
                    >
                        <VscSync />
                    </Button>
                </div>
                <ClusterStatusComp clusterStatus={clusterStatusSignal.value[cluster.id]} />
            </div>
        );
    };
}
