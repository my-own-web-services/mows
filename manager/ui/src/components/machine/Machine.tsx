import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { IoTerminal } from "react-icons/io5";
import { VscDebugStart, VscDebugStop, VscSync, VscSyncIgnored, VscTrash } from "react-icons/vsc";
import { Button } from "rsuite";
import { Api, Machine, MachineSignal, MachineStatus, VncWebsocket } from "../../api-client";
import TerminalComponent from "../Terminal";
import MachineProviderIcon from "./MachineProviderIcon";
import MachineScreen from "./MachineScreen";
import MachineStatusComp from "./MachineStatusComp";

interface MachineComponentProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly machine: Machine;
    readonly machineStatus?: MachineStatus;
}

interface MachineComponentState {
    readonly sshOpen: boolean;
    readonly vncWebsocket: VncWebsocket | null;
}

export default class MachineComponent extends Component<
    MachineComponentProps,
    MachineComponentState
> {
    private client: Api<unknown>;

    constructor(props: MachineComponentProps) {
        super(props);
        this.state = {
            sshOpen: false,
            vncWebsocket: null
        };
        this.client = new Api({ baseUrl: "http://localhost:3000" });
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
        //(this.getVncWebsocket();
    };

    toggleSSH = async () => {
        this.setState({ sshOpen: !this.state.sshOpen });
    };

    private getVncWebsocket = async () => {
        const ws = (await this.client.api.getVncWebsocket(this.props.machine.id)).data;
        this.setState({ vncWebsocket: ws.data });
    };

    private signalMachine = async (signal: MachineSignal) => {
        await this.client.api.signalMachine({
            machine_id: this.props.machine.id,
            signal
        });
    };

    delete = async () => {
        await this.client.api.deleteMachine({
            machine_id: this.props.machine.id
        });
    };

    render = () => {
        const machineStatus = this.props.machineStatus;
        const buttonSize = "sm";

        return (
            <div
                style={{ ...this.props.style }}
                className={`MachineComponent ${this.props.className ?? ""}`}
            >
                <div className={"flex gap-4"}>
                    <div className={"w-1/3"}>
                        <h1 className="flex items-center gap-2 pb-1 text-xl">
                            <MachineStatusComp machineStatus={machineStatus} />
                            <MachineProviderIcon machine={this.props.machine} />
                            <span className={"line"}>{this.props.machine.id}</span>
                        </h1>

                        <MachineScreen
                            vncWebsocket={this.state.vncWebsocket}
                            machineStatus={machineStatus}
                            machine={this.props.machine}
                        />

                        <div className="flex gap-2 pt-2">
                            <Button
                                title="Start"
                                size={buttonSize}
                                onClick={() => this.signalMachine(MachineSignal.Start)}
                            >
                                <VscDebugStart />
                            </Button>
                            <Button
                                title="Shutdown"
                                size={buttonSize}
                                onClick={() => this.signalMachine(MachineSignal.Shutdown)}
                            >
                                <VscDebugStop />
                            </Button>
                            <Button
                                title="Reboot"
                                size={buttonSize}
                                onClick={() => this.signalMachine(MachineSignal.Reboot)}
                            >
                                <VscSync />
                            </Button>
                            <Button
                                title="Reset"
                                size={buttonSize}
                                onClick={() => this.signalMachine(MachineSignal.Reset)}
                            >
                                <VscSyncIgnored />
                            </Button>
                            <Button
                                title="Force Off"
                                size={buttonSize}
                                onClick={() => this.signalMachine(MachineSignal.ForceOff)}
                            >
                                💥
                            </Button>
                            <Button title="Delete" size={buttonSize} onClick={() => this.delete()}>
                                <VscTrash />
                            </Button>
                        </div>

                        <div className={"flex flex-col gap-1 pt-2"}>
                            <Button className="w-8" title="Toggle SSH" onClick={this.toggleSSH}>
                                <div className={"scale-100"}>
                                    <IoTerminal />
                                </div>
                            </Button>
                        </div>
                    </div>
                    <div className="w-2/3">
                        {this.state.sshOpen ? (
                            <TerminalComponent className="w-full" id={this.props.machine.id} />
                        ) : (
                            ""
                        )}
                    </div>
                </div>
            </div>
        );
    };
}
// <TerminalComponent type="direct" className="w-2/3" id={this.props.machine.id} />
