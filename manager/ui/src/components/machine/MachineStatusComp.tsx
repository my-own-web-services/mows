import { PureComponent, type CSSProperties } from "react";
import { match } from "ts-pattern";
import { MachineStatus } from "../../api-client";

interface MachineStatusCompProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly machineStatus?: MachineStatus;
}

interface MachineStatusCompState {}

export default class MachineStatusComp extends PureComponent<
    MachineStatusCompProps,
    MachineStatusCompState
> {
    render = () => {
        const colorClass = match(this.props.machineStatus)
            .with(MachineStatus.Running, () => `bg-[lime]`)
            .with(MachineStatus.Stopped, () => `bg-[gray]`)
            .with(MachineStatus.Unknown, () => `bg-[black]`)
            .otherwise(() => `bg-[black]`);
        const title = match(this.props.machineStatus)
            .with(MachineStatus.Running, () => `Running`)
            .with(MachineStatus.Stopped, () => `Stopped`)
            .with(MachineStatus.Unknown, () => `Unknown`)
            .otherwise(() => `Unknown`);

        return (
            <span
                title={title}
                className={`h-4 w-4 rounded-full align-middle ${colorClass}`}
            ></span>
        );
    };
}
