import { Component } from "preact/compat";
import { Button, Input } from "rsuite";
import { Api } from "../api-client";
import { configSignal } from "../config";
import TerminalComponent from "./Terminal";
import VNC from "./VNC";

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
    };

    createCluster = async () => {
        await this.props.client.api.createCluster({}).catch(console.error);
    };

    setConfig = async () => {
        await this.props.client.api
            .updateConfig(JSON.parse(this.state.configToSet))
            .catch(console.error);
    };

    deleteAllMowsMachines = async () => {
        if (!configSignal.value?.machines) {
            return;
        }
        for (const [machine_id, machine] of Object.entries(configSignal.value.machines)) {
            await this.props.client.api.deleteMachine({ machine_id }).catch(console.error);
        }
    };

    render = () => {
        return (
            <div className="Dev h-full w-full">
                <div className={"p-4"}>
                    <div className="flex flex-row gap-4">
                        <Button onClick={this.deleteAllMowsMachines}>
                            Delete all MOWS virtual machines
                        </Button>
                        <Input
                            placeholder="Set Config"
                            className="w-[100px]"
                            value={this.state.configToSet}
                        />
                        <Button onClick={this.setConfig}>Set config</Button>

                        <Button onClick={this.createMachines}>Create virtual machines</Button>
                        <Button onClick={this.createCluster}>
                            Create cluster from all machines in inventory
                        </Button>
                    </div>
                    <div className={"flex h-[400px] items-stretch pt-4"}>
                        <div className={"h-full w-1/3 pr-4"}>
                            <pre className="box-border h-full w-full resize-none break-words rounded-lg bg-[black] p-2">
                                {JSON.stringify(configSignal.value, null, 4)}
                            </pre>
                        </div>

                        <div className="h-full w-2/3">
                            <TerminalComponent url="ws://localhost:3000/api/terminal/local" />
                        </div>
                    </div>
                    <div className={"pt-4"}>
                        <h1 className={"pb-4 text-2xl"}>Machines</h1>
                        <div className="flex w-full justify-start gap-4">
                            {configSignal.value?.machines &&
                                Object.entries(configSignal.value?.machines).map(
                                    ([machine_id, machine]) => {
                                        return (
                                            <VNC
                                                className="w-1/3"
                                                key={machine_id}
                                                machine={machine}
                                            />
                                        );
                                    }
                                )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };
}
