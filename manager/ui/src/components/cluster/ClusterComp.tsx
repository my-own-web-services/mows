import { effect } from "@preact/signals-react";
import { Button } from "@my-own-web-services/react-components/components/ui/button";
import { MowsContext } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import { PureComponent, type CSSProperties } from "react";
import { GrResume } from "react-icons/gr";
import { TbSnowflake } from "react-icons/tb";
import { VscDebugStart, VscDebugStop, VscSync } from "react-icons/vsc";
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

export default class ClusterComp extends PureComponent<ClusterCompProps, ClusterCompState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;
    private disposeSignalEffect: (() => void) | null = null;

    componentDidMount = () => {
        let firstRun = true;
        this.disposeSignalEffect = effect(() => {
            void clusterStatusSignal.value;
            if (firstRun) {
                firstRun = false;
                return;
            }
            this.forceUpdate();
        });
    };

    componentWillUnmount = () => {
        this.disposeSignalEffect?.();
    };

    private signalCluster = async (signal: ClusterSignal) => {
        await this.props.client.api.signalCluster({
            cluster_id: this.props.cluster.id,
            signal
        });
    };

    render = () => {
        const cluster = this.props.cluster;
        const t = this.context!.t.manager.cluster;

        return (
            <div
                style={this.props.style}
                className={`ClusterComp h-32 w-full ${this.props.className ?? ``}`}
            >
                <h1 className={`flex items-center gap-2 pb-1 text-xl`}>
                    <span>{cluster.id}</span>
                </h1>
                <div className={`flex gap-2 pt-2`}>
                    <Button variant={`secondary`}
                        size={`sm`}
                        title={t.start}
                        onClick={() => this.signalCluster(ClusterSignal.Start)}
                    >
                        <VscDebugStart />
                    </Button>
                    <Button variant={`secondary`}
                        size={`sm`}
                        title={t.stop}
                        onClick={() => this.signalCluster(ClusterSignal.Stop)}
                    >
                        <VscDebugStop />
                    </Button>
                    <Button variant={`secondary`}
                        size={`sm`}
                        title={t.restart}
                        onClick={() => this.signalCluster(ClusterSignal.Restart)}
                    >
                        <VscSync />
                    </Button>
                    <Button variant={`secondary`}
                        size={`sm`}
                        title={t.suspend}
                        onClick={() => this.signalCluster(ClusterSignal.Suspend)}
                    >
                        <TbSnowflake />
                    </Button>
                    <Button variant={`secondary`}
                        size={`sm`}
                        title={t.resume}
                        onClick={() => this.signalCluster(ClusterSignal.Resume)}
                    >
                        <GrResume />
                    </Button>
                </div>
                <ClusterStatusComp clusterStatus={clusterStatusSignal.value[cluster.id]} />
            </div>
        );
    };
}
