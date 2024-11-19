import { isEqual } from "lodash";
import { Component } from "preact";
import { CSSProperties } from "preact/compat";
//@ts-ignore
import { VncScreen } from "react-vnc";
import { Machine, MachineStatus, VncWebsocket } from "../../api-client";

interface MachineScreenProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly machine: Machine;
    readonly machineStatus?: string;
    readonly vncWebsocket: VncWebsocket | null;
}
interface MachineScreenState {}

export default class MachineScreen extends Component<MachineScreenProps, MachineScreenState> {
    constructor(props: MachineScreenProps) {
        super(props);
        this.state = {
            url: "",
            machine_infos: null
        };
    }

    componentDidMount = async () => {};

    shouldComponentUpdate = (
        nextProps: Readonly<MachineScreenProps>,
        _nextState: Readonly<MachineScreenState>,
        _nextContext: any
    ): boolean => {
        return (
            !isEqual(nextProps.machine, this.props.machine) ||
            !isEqual(nextProps.vncWebsocket, this.props.vncWebsocket) ||
            !isEqual(nextProps.machine.id, this.props.machine.id) ||
            !isEqual(nextProps.machineStatus, this.props.machineStatus)
        );
    };

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`MachineScreen ${this.props.className ?? ""}`}
            >
                <div
                    className={
                        "pointer-events-none flex min-h-[300px] w-full items-center justify-center rounded-lg bg-[black] p-2"
                    }
                >
                    {this.props.machineStatus === MachineStatus.Running ? (
                        <VncScreen
                            rfbOptions={{
                                credentials: {
                                    password: this.props.vncWebsocket?.password
                                }
                            }}
                            url={this.props.vncWebsocket?.url}
                            backgroundColor="#000"
                            loadingUI={<div></div>}
                        />
                    ) : (
                        <div
                            className={
                                "flex h-full w-full items-center justify-center text-[lightgrey]"
                            }
                        >
                            {this.props.machineStatus ?? "Loading..."}
                        </div>
                    )}
                </div>
            </div>
        );
    };
}
