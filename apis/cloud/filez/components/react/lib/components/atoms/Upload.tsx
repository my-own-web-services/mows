import { cn } from "@/lib/utils";
import { PureComponent, type CSSProperties } from "react";

interface UploadProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface UploadState {}

export default class Upload extends PureComponent<UploadProps, UploadState> {
    constructor(props: UploadProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`Upload`, this.props.className)}
            ></div>
        );
    };
}
