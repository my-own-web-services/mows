import { PureComponent } from "react";
import { Button } from "rsuite";
import { Api } from "../api-client";
import TerminalComponent from "./Terminal";

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
            <div className="Dev">
                <textarea value={this.props.config} onChange={this.props.updateConfig}></textarea>{" "}
                <br />
                <Button onClick={this.deleteAllMowsMachines}>
                    Delete all MOWS virtual machines
                </Button>
                <br />
                <Button onClick={this.updateConfig}>Update config</Button>
                <br />
                <Button onClick={this.createMachines}>Create virtual machines</Button>
                <br />
                <Button onClick={this.createCluster}>
                    Create cluster from all machines in inventory
                </Button>
                <TerminalComponent />
            </div>
        );
    };
}
