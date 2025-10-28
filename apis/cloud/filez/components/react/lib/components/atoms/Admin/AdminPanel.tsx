import { cn } from "@/lib/utils";
import { PureComponent, type CSSProperties } from "react";

interface AdminPanelProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AdminPanelState {}

export default class AdminPanel extends PureComponent<AdminPanelProps, AdminPanelState> {
    constructor(props: AdminPanelProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`AdminPanel`, this.props.className)}
            ></div>
        );
    };
}
