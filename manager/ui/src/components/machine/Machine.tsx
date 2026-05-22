import { Button } from "@mows/react-components/components/ui/button";
import { MowsContext } from "@mows/react-components/lib/mowsContext/MowsContext";
import { PureComponent, type CSSProperties } from "react";
import { GrResume } from "react-icons/gr";
import { IoTerminal } from "react-icons/io5";
import { TbSnowflake } from "react-icons/tb";
import { VscDebugStart, VscDebugStop, VscSync, VscSyncIgnored, VscTrash } from "react-icons/vsc";
import { Api, Machine, MachineSignal, MachineStatus, VncWebsocket } from "../../api-client";
import TabbedTerminal from "../TabbedTerminal";
import MachineProviderIcon from "./MachineProviderIcon";
import MachineScreen from "./MachineScreen";
import MachineStatusComp from "./MachineStatusComp";

interface MachineComponentProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly machine: Machine;
    readonly machineStatus?: MachineStatus;
    readonly client: Api<unknown>;
}

interface MachineComponentState {
    readonly sshOpen: boolean;
    readonly vncWebsocket: VncWebsocket | null;
}

export default class MachineComponent extends PureComponent<
    MachineComponentProps,
    MachineComponentState
> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    constructor(props: MachineComponentProps) {
        super(props);
        this.state = {
            sshOpen: false,
            vncWebsocket: null
        };
    }

    componentDidMount = async () => {
        this.getVncWebsocket();
    };

    componentDidUpdate = async (prevProps: MachineComponentProps) => {
        if (
            prevProps.machine.id !== this.props.machine.id ||
            prevProps.machineStatus !== this.props.machineStatus
        ) {
            this.getVncWebsocket();
        }
    };

    toggleSSH = () => {
        this.setState({ sshOpen: !this.state.sshOpen });
    };

    private getVncWebsocket = async () => {
        const ws = (await this.props.client.api.getVncWebsocket(this.props.machine.id)).data;
        this.setState({ vncWebsocket: ws.data ?? null });
    };

    private signalMachine = async (signal: MachineSignal) => {
        await this.props.client.api.signalMachine({
            machine_id: this.props.machine.id,
            signal
        });
    };

    delete = async () => {
        await this.props.client.api.deleteMachine({
            machine_id: this.props.machine.id
        });
    };

    render = () => {
        const machineStatus = this.props.machineStatus;
        const t = this.context!.t.manager.machine;

        return (
            <div
                style={this.props.style}
                className={`MachineComponent ${this.props.className ?? ``}`}
            >
                <div className={`flex gap-4`}>
                    <div className={`w-1/3`}>
                        <h1 className={`flex items-center gap-2 pb-1 text-xl`}>
                            <MachineStatusComp machineStatus={machineStatus} />
                            <MachineProviderIcon machine={this.props.machine} />
                            <span>{this.props.machine.id}</span>
                        </h1>

                        <MachineScreen
                            vncWebsocket={this.state.vncWebsocket}
                            machineStatus={machineStatus}
                            machine={this.props.machine}
                        />

                        <div className={`flex gap-2 pt-2`}>
                            <Button variant={`secondary`}
                                size={`sm`}
                                title={t.start}
                                onClick={() => this.signalMachine(MachineSignal.Start)}
                            >
                                <VscDebugStart />
                            </Button>
                            <Button variant={`secondary`}
                                size={`sm`}
                                title={t.shutdown}
                                onClick={() => this.signalMachine(MachineSignal.Shutdown)}
                            >
                                <VscDebugStop />
                            </Button>
                            <Button variant={`secondary`}
                                size={`sm`}
                                title={t.reboot}
                                onClick={() => this.signalMachine(MachineSignal.Reboot)}
                            >
                                <VscSync />
                            </Button>
                            <Button variant={`secondary`}
                                size={`sm`}
                                title={t.reset}
                                onClick={() => this.signalMachine(MachineSignal.Reset)}
                            >
                                <VscSyncIgnored />
                            </Button>
                            <Button variant={`secondary`}
                                size={`sm`}
                                title={t.forceOff}
                                onClick={() => this.signalMachine(MachineSignal.ForceOff)}
                            >
                                💥
                            </Button>
                            <Button variant={`secondary`}
                                size={`sm`}
                                title={t.suspend}
                                onClick={() => this.signalMachine(MachineSignal.Suspend)}
                            >
                                <TbSnowflake />
                            </Button>
                            <Button variant={`secondary`}
                                size={`sm`}
                                title={t.resume}
                                onClick={() => this.signalMachine(MachineSignal.Resume)}
                            >
                                <GrResume />
                            </Button>
                            <Button
                                size={`sm`}
                                title={t.delete}
                                variant={`destructive`}
                                onClick={() => this.delete()}
                            >
                                <VscTrash />
                            </Button>
                        </div>

                        <div className={`flex flex-col gap-1 pt-2`}>
                            <Button variant={`secondary`}
                                size={`sm`}
                                className={`w-8`}
                                title={t.toggleSsh}
                                onClick={this.toggleSSH}
                            >
                                <IoTerminal />
                            </Button>
                        </div>
                    </div>
                    <div className={`w-2/3`}>
                        {this.state.sshOpen ? (
                            <TabbedTerminal
                                className={`w-full`}
                                defaultTerminalId={this.props.machine.id}
                                defaultTitle={this.props.machine.id}
                            />
                        ) : null}
                    </div>
                </div>
            </div>
        );
    };
}
