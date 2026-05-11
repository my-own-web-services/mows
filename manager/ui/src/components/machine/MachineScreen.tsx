import { isEqual } from "lodash";
import { Component, createRef, type CSSProperties, type RefObject } from "react";
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
    private vncRef: RefObject<any | null>;

    constructor(props: MachineScreenProps) {
        super(props);
        this.state = {};
        this.vncRef = createRef();
    }

    componentDidMount = () => {
        if (this.vncRef.current) {
            // react-vnc finishes its own RFB handshake after the ref settles
            // on the next microtask, so disconnect/connect issued in the same
            // tick races and stalls the canvas. Wait one paint frame, then
            // toggle the connection so the underlying noVNC client picks up
            // the latest url + credentials. Tracked upstream:
            // https://github.com/roerohan/react-vnc/issues — no event hook yet.
            requestAnimationFrame(() => {
                this.vncRef.current?.disconnect();
                this.vncRef.current?.connect();
            });
        }
    };

    shouldComponentUpdate = (nextProps: Readonly<MachineScreenProps>): boolean =>
        !isEqual(nextProps.machine, this.props.machine) ||
        !isEqual(nextProps.vncWebsocket, this.props.vncWebsocket) ||
        !isEqual(nextProps.machine.id, this.props.machine.id) ||
        !isEqual(nextProps.machineStatus, this.props.machineStatus);

    componentWillUnmount = () => {
        if (this.vncRef.current) {
            this.vncRef.current.disconnect();
            this.vncRef.current = null;
        }
    };

    render = () => (
        <div
            style={this.props.style}
            className={`MachineScreen ${this.props.className ?? ``}`}
        >
            <div
                className={`pointer-events-none flex min-h-[300px] w-full items-center justify-center rounded-lg bg-black p-2`}
            >
                {this.props.machineStatus === MachineStatus.Running ? (
                    <VncScreen
                        rfbOptions={{
                            credentials: {
                                password: this.props.vncWebsocket?.password
                            }
                        }}
                        url={this.props.vncWebsocket?.url}
                        backgroundColor={`#000`}
                        loadingUI={<div></div>}
                        ref={this.vncRef}
                    />
                ) : (
                    <div
                        className={`flex h-full w-full items-center justify-center text-[lightgrey]`}
                    >
                        {this.props.machineStatus ?? `Loading...`}
                    </div>
                )}
            </div>
        </div>
    );
}
