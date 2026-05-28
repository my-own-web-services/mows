import { MowsContext } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import { PureComponent, type CSSProperties } from "react";
import { IoHardwareChipOutline } from "react-icons/io5";
import { SiHetzner, SiQemu } from "react-icons/si";
import { match } from "ts-pattern";
import { Machine, MachineType } from "../../api-client";

interface MachineProviderIconProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly machine: Machine;
}

interface MachineProviderIconState {}

export default class MachineProviderIcon extends PureComponent<
    MachineProviderIconProps,
    MachineProviderIconState
> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    render = () => {
        const size = 18;
        const t = this.context!.t.manager.machine.providers;

        return (
            <div
                style={this.props.style}
                className={`MachineProviderIcon ${this.props.className ?? ``}`}
            >
                {match(this.props.machine.machine_type)
                    .with(MachineType.LocalQemu, () => (
                        <SiQemu size={size} color={`#f14e28`} title={t.qemu} />
                    ))
                    .with(MachineType.LocalPhysical, () => (
                        <IoHardwareChipOutline size={size} title={t.bareMetal} />
                    ))
                    .with(MachineType.ExternalHcloud, () => (
                        <SiHetzner color={`red`} size={size} title={`hcloud`} />
                    ))
                    .exhaustive()}
            </div>
        );
    };
}
