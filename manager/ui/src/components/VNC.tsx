import { PureComponent, CSSProperties, createRef } from "react";
//@ts-ignore
import { VncScreen, RFB } from "react-vnc";
import { Button } from "rsuite";

interface VNCProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly url: string;
}

interface VNCState {}

export default class VNC extends PureComponent<VNCProps, VNCState> {
    private vncRef = createRef<VncScreen>();
    constructor(props: VNCProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    reboot = () => {
        this.vncRef.current.rfb.machineReset();
    };

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`VNC w-full h-full${this.props.className ?? ""}`}
            >
                <Button onClick={this.reboot}>Reboot</Button>
                <div className="w-full h-full bg-[#000] ">
                    <VncScreen
                        url={this.props.url}
                        scaleViewport
                        background="#000000"
                        className="w-full h-full"
                        ref={this.vncRef}
                    />
                </div>
            </div>
        );
    };
}
