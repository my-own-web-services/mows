import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { IoTerminal } from "react-icons/io5";
import { Button } from "rsuite";
import { Machine } from "../api-client";
import { machineStatusSignal } from "../config";
import TerminalComponent from "./Terminal";
import VNC from "./VNC";

interface MachineComponentProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly machine: Machine;
}

interface MachineComponentState {
    readonly sshOpen: boolean;
}

export default class MachineComponent extends Component<
    MachineComponentProps,
    MachineComponentState
> {
    constructor(props: MachineComponentProps) {
        super(props);
        this.state = {
            sshOpen: false
        };
    }

    componentDidMount = async () => {};

    toggleSSH = async () => {
        this.setState({ sshOpen: !this.state.sshOpen });
    };

    render = () => {
        const machineStatus = machineStatusSignal.value[this.props.machine.id];
        return (
            <div
                style={{ ...this.props.style }}
                className={`MachineComponent ${this.props.className ?? ""}`}
            >
                <div className={"flex gap-4"}>
                    <div className={"w-1/3"}>
                        <h1 className="pb-1 text-xl">
                            <span
                                className={(() => {
                                    const classes = [
                                        "mr-2",
                                        "inline-block",
                                        "h-4",
                                        "w-4",
                                        "rounded-full",
                                        "align-middle"
                                    ];

                                    if (machineStatus === `running\n\n`) {
                                        classes.push("bg-[lime]");
                                    } else if (machineStatus === `shut off\n\n`) {
                                        classes.push("bg-[gray]");
                                    } else {
                                        classes.push("bg-[gray]");
                                    }
                                    return classes.join(" ");
                                })()}
                            ></span>
                            {this.props.machine.id}
                        </h1>

                        <VNC machine={this.props.machine} />
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
                            <TerminalComponent
                                type="direct"
                                className="w-full"
                                id={this.props.machine.id}
                            />
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
