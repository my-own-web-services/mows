import { PureComponent } from "react";
import { Button } from "rsuite";
import { Api } from "../api-client";
import TerminalComponent from "./Terminal";
import "@fontsource-variable/inter";
import VNC from "./VNC";

interface DevProps {
    readonly client: Api<unknown>;
    readonly config: string;
    readonly loadConfig: () => Promise<void>;
    readonly updateConfig: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

interface DevState {}

export default class Dev extends PureComponent<DevProps, DevState> {
    constructor(props: DevProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    createMachines = async () => {
        await this.props.client.api
            .createMachines({ LocalQemu: { memory: 4, cpus: 2 } })
            .catch(console.error);
    };

    createCluster = async () => {
        await this.props.client.api.createCluster({}).catch(console.error);
    };

    updateConfig = async () => {
        await this.props.client.api
            .updateConfig(JSON.parse(this.props.config))
            .catch(console.error);
    };

    deleteAllMowsMachines = async () => {
        await this.props.client.api.deleteAllMachines().catch(console.error);
    };

    render = () => {
        return (
            <div className="Dev w-full h-full">
                <textarea
                    className="w-[500px] h-[200px] block"
                    value={this.props.config}
                    onChange={this.props.updateConfig}
                ></textarea>{" "}
                <br />
                <div className="flex gap-4">
                    <Button onClick={this.deleteAllMowsMachines}>
                        Delete all MOWS virtual machines
                    </Button>
                    <Button onClick={this.updateConfig}>Update config</Button>
                    <Button onClick={this.createMachines}>Create virtual machines</Button>
                    <Button onClick={this.createCluster}>
                        Create cluster from all machines in inventory
                    </Button>
                </div>
                <div className="w-full h-[500px]">
                    <TerminalComponent url="ws://localhost:3000/api/terminal/local" />
                </div>
                <div className="flex w-full h-72 gap-4 justify-around">
                    <VNC url="ws://localhost:5700" />
                    <VNC url="ws://localhost:5701" />
                    <VNC url="ws://localhost:5702" />
                </div>
            </div>
        );
    };
}
