//@ts-ignore
import { VncScreen } from "react-vnc";
import { Button } from "rsuite";
import { Api, Machine, MachineSignal } from "../api-client";
import { Component } from "preact";
import { CSSProperties } from "preact/compat";

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
        return (
            <div style={{ ...this.props.style }} className={`VNC ${this.props.className ?? ""}`}>
                <div className="flex gap-1">
                    <Button size="xs" onClick={() => this.signalMachine(MachineSignal.Start)}>
                        Start
                    </Button>
                    <Button size="xs" onClick={() => this.signalMachine(MachineSignal.Shutdown)}>
                        Shutdown
                    </Button>
                    <Button size="xs" onClick={() => this.signalMachine(MachineSignal.Reboot)}>
                        Reboot
                    </Button>
                    <Button size="xs" onClick={() => this.signalMachine(MachineSignal.Reset)}>
                        Reset
                    </Button>
                    <Button size="xs" onClick={() => this.signalMachine(MachineSignal.ForceOff)}>
                        ForceOff
                    </Button>
                    <Button size="xs" onClick={() => this.delete()}>
                        Delete
                    </Button>
                </div>
                <div>
                    {this.state.machine_infos !== null && (
                        <VncScreen
                            style={{ width: "100%", height: "100%" }}
                            url={this.getUrl(this.state.machine_infos)}
                            backgroundColor="#000"
                        />
                    )}
                </div>
            </div>
        );
    };
}
