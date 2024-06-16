import { Button, Input } from "rsuite";
import { Api, ManagerConfig } from "../api-client";
import TerminalComponent from "./Terminal";
import VNC from "./VNC";
import { Component } from "preact/compat";
import { configSignal, reloadConfig } from "../config";

interface DevProps {
    readonly client: Api<unknown>;
}

interface DevState {
    readonly configToSet: string;
}

export default class Dev extends Component<DevProps, DevState> {
    constructor(props: DevProps) {
        super(props);
        this.state = {
            configToSet: ""
        };
    }

    componentDidMount = async () => {};

    createMachines = async () => {
        await this.props.client.api
            .createMachines({ LocalQemu: { memory: 4, cpus: 2 } })
            .catch(console.error);
        await reloadConfig();
    };

    createCluster = async () => {
        await this.props.client.api.createCluster({}).catch(console.error);
        await reloadConfig();
    };

    setConfig = async () => {
        await this.props.client.api
            .updateConfig(JSON.parse(this.state.configToSet))
            .catch(console.error);
        await reloadConfig();
    };

    deleteAllMowsMachines = async () => {
        if (!configSignal.value?.machines) {
            return;
        }
        for (const [machine_id, machine] of Object.entries(configSignal.value.machines)) {
            await this.props.client.api.deleteMachine({ machine_id }).catch(console.error);
        }
        await reloadConfig();
    };

    render = () => {
        return (
            <div className="Dev w-full h-full">
                <textarea
                    className="w-full h-[200px] block"
                    value={JSON.stringify(configSignal.value, null, 4)}
                    readOnly
                    disabled
                />
                <br />
                <div className="flex gap-4">
                    <Button onClick={this.deleteAllMowsMachines}>
                        Delete all MOWS virtual machines
                    </Button>
                    <Input
                        placeholder="Set Config"
                        className="w-[100px]"
                        value={this.state.configToSet}
                    />
                    <Button onClick={this.setConfig}>Set config</Button>

                    <Button onClick={reloadConfig}>Reload config</Button>
                    <Button onClick={this.createMachines}>Create virtual machines</Button>
                    <Button onClick={this.createCluster}>
                        Create cluster from all machines in inventory
                    </Button>
                </div>
                <div className="w-full h-[500px]">
                    <TerminalComponent url="ws://localhost:3000/api/terminal/local" />
                </div>
                <div className="flex w-full gap-4 justify-start">
                    {configSignal.value?.machines &&
                        Object.entries(configSignal.value?.machines).map(
                            ([machine_id, machine]) => {
                                return <VNC className="w-1/3" key={machine_id} machine={machine} />;
                            }
                        )}
                </div>
            </div>
        );
    };
}
