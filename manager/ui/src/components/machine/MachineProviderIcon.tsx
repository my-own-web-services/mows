import { Component } from "preact";
import { CSSProperties } from "preact/compat";
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

export default class MachineProviderIcon extends Component<
    MachineProviderIconProps,
    MachineProviderIconState
> {
    constructor(props: MachineProviderIconProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        const size = 18;

        return (
            <div
                style={{ ...this.props.style }}
                className={`MachineProviderIcon ${this.props.className ?? ""}`}
            >
                {match(this.props.machine.machine_type)
                    .with(MachineType.LocalQemu, () => (
                        <SiQemu size={size} color="#f14e28" title={"Qemu"} />
                    ))
                    .with(MachineType.LocalPhysical, () => (
                        <IoHardwareChipOutline size={size} title="Bare Metal" />
                    ))
                    .with(MachineType.ExternalHcloud, () => (
                        <SiHetzner color="red" size={size} title="hcloud" />
                    ))
                    .exhaustive()}
            </div>
        );
    };
}
