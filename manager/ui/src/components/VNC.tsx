import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { VscDebugStart, VscDebugStop, VscSync, VscSyncIgnored, VscTrash } from "react-icons/vsc";
//@ts-ignore
import { VncScreen } from "react-vnc";
import { Button } from "rsuite";
import { Api, Machine, MachineSignal } from "../api-client";
import { machineStatusSignal } from "../config";

interface VNCProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly machine: Machine;
}

interface VNCState {
    readonly url: string;
    readonly machine_infos: any | null;
}

export default class VNC extends Component<VNCProps, VNCState> {
    private client: Api<unknown>;
    constructor(props: VNCProps) {
        super(props);
        this.state = {
            url: "",
            machine_infos: null
        };
        this.client = new Api({ baseUrl: "http://localhost:3000" });
    }

    componentDidMount = async () => {
        this.loadMachineInfo();
    };

    componentDidUpdate(
        prevProps: Readonly<VNCProps>,
        _prevState: Readonly<VNCState>,
        _snapshot?: any
    ): void {
        // deep compare
        if (
            JSON.stringify(prevProps.machine) !== JSON.stringify(this.props.machine) ||
            prevProps.machine.id !== this.props.machine.id
        ) {
            this.loadMachineInfo();
        }
    }

    loadMachineInfo = async () => {
        const {
            data: { machine_infos }
        } = await this.client.api.getMachineInfo({
            machine_id: this.props.machine.id
        });
        this.setState({ machine_infos: null }, () => {
            this.setState({ machine_infos });
        });
    };

    signalMachine = async (signal: MachineSignal) => {
        await this.client.api.signalMachine({
            machine_id: this.props.machine.id,
            signal
        });
        this.loadMachineInfo();
    };

    delete = async () => {
        await this.client.api.deleteMachine({
            machine_id: this.props.machine.id
        });
    };

    getUrl(machine_infos: any) {
        const port = machine_infos?.devices?.graphics?.websocket;

        const host = window.location.hostname;

        if (!port || port === "-1") {
            return "";
        }

        return `ws://${host}:${port}`;
    }

    render = () => {
        const buttonSize = "sm";
        const machineStatus = machineStatusSignal.value[this.props.machine.id];
        return (
            <div style={{ ...this.props.style }} className={`VNC ${this.props.className ?? ""}`}>
                <div
                    className={
                        "pointer-events-none flex min-h-[300px] w-full items-center justify-center rounded-lg bg-[black] p-2"
                    }
                >
                    {this.state.machine_infos !== null && machineStatus === "running\n\n" ? (
                        <VncScreen
                            url={this.getUrl(this.state.machine_infos)}
                            backgroundColor="#000"
                            loadingUI={<div></div>}
                        />
                    ) : (
                        <div
                            className={
                                "flex h-full w-full items-center justify-center text-[lightgrey]"
                            }
                        >
                            {machineStatus ?? "Loading..."}
                        </div>
                    )}
                </div>
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
                    <Button size={buttonSize} onClick={() => this.delete()}>
                        <VscTrash />
                    </Button>
                </div>
            </div>
        );
    };
}
