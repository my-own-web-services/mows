import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { match } from "ts-pattern";
import { MachineStatus } from "../../api-client";

interface MachineStatusCompProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly machineStatus?: MachineStatus;
}

interface MachineStatusCompState {}

export default class MachineStatusComp extends Component<
    MachineStatusCompProps,
    MachineStatusCompState
> {
    constructor(props: MachineStatusCompProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <span
                title={match(this.props.machineStatus)
                    .with(MachineStatus.Running, () => "Running")
                    .with(MachineStatus.Stopped, () => "Stopped")
                    .with(MachineStatus.Unknown, () => "Unknown")
                    .otherwise(() => "Unknown")}
                className={(() => {
                    const classes = ["h-4", "w-4", "rounded-full", "align-middle"];

                    match(this.props.machineStatus)
                        .with(MachineStatus.Running, () => classes.push("bg-[lime]"))
                        .with(MachineStatus.Stopped, () => classes.push("bg-[gray]"))
                        .with(MachineStatus.Unknown, () => classes.push("bg-[black]"))
                        .otherwise(() => classes.push("bg-[black]"));

                    return classes.join(" ");
                })()}
            ></span>
        );
    };
}
