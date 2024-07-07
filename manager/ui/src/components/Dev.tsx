import { Component } from "preact/compat";
import { Button, Input, Message, useToaster } from "rsuite";
import { ToastContainerProps } from "rsuite/esm/toaster/ToastContainer";
import {
    Api,
    ApiResponse,
    ApiResponseStatus,
    Cluster,
    HttpResponse,
    ManagerConfig
} from "../api-client";
import { configSignal } from "../config";
import { withToasterHook } from "../utils"; // Ensure the path is correct
import MachineComponent from "./Machine";
import Notes from "./Notes";
import TerminalComponent from "./Terminal";

interface DevProps {
    readonly client: Api<unknown>;
    readonly toaster: ReturnType<typeof useToaster>;
}

interface DevState {
    readonly configToSet: string;
}

const urls = [
    { url: "http://localhost:16686/search?service=manager", title: "Jaeger" },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-network/services/http:hubble-ui:http/proxy/",
        title: "Hubble/Cilium/Network"
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-storage/services/http:longhorn-frontend:http/proxy/",
        title: "Longhorn/Storage"
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:443/proxy/",
        title: "K8s Dashboard"
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-monitoring/services/http:mows-monitoring-grafana:80/proxy/",
        title: "Grafana/Monitoring"
        // admin // prom-operator
    }
];

const toastParams: ToastContainerProps = { placement: "bottomEnd", duration: 5000 };

class Dev extends Component<DevProps, DevState> {
    constructor(props: DevProps) {
        super(props);
        this.state = {
            configToSet: ""
        };
    }

    componentDidMount = async () => {};

    handleApiCall = async (apiCall: () => Promise<HttpResponse<ApiResponse>>) => {
        await apiCall()
            .then(({ data }) => {
                this.props.toaster.push(
                    <Message
                        showIcon
                        type={data.status === ApiResponseStatus.Success ? "success" : "error"}
                        header={data.status}
                        closable
                    >
                        {data.message}
                    </Message>,
                    toastParams
                );
            })
            .catch((error) => {
                this.props.toaster.push(
                    <Message showIcon type="error" header="Error" closable>
                        {error.message}
                    </Message>,
                    toastParams
                );
            });
    };

    createMachines = async () => {
        await this.handleApiCall(() =>
            this.props.client.api.devCreateMachines({ LocalQemu: { memory: 4, cpus: 2 } })
        );
    };

    devCreateClusterFromAllMachinesInInventory = async () => {
        await this.handleApiCall(() =>
            this.props.client.api.devCreateClusterFromAllMachinesInInventory({})
        );
    };

    setConfig = async () => {
        await this.handleApiCall(() =>
            this.props.client.api.updateConfig(JSON.parse(this.state.configToSet))
        );
    };

    deleteAllMowsMachines = async () => {
        await this.handleApiCall(() => this.props.client.api.devDeleteAllMachines());
    };

    loadConfigFromLocalStorage = async () => {
        const mb_config = localStorage.getItem("config");
        if (mb_config) {
            const config: ManagerConfig = JSON.parse(mb_config);
            configSignal.value = config;
            await this.handleApiCall(() => this.props.client.api.updateConfig(config));
        }
    };

    saveConfigToLocalStorage = () => {
        localStorage.setItem("config", JSON.stringify(configSignal.value));
        this.props.toaster.push(
            <Message showIcon type="success" header="Success" closable>
                Config saved to local storage
            </Message>,
            toastParams
        );
    };

    installClusterBasics = async () => {
        await this.handleApiCall(() => this.props.client.api.devInstallClusterBasics());
    };

    clusterServiceUrl = (clusters: Record<string, Cluster> | undefined) => {
        for (const [_, cluster] of Object.entries(clusters || {})) {
            return (
                <a href={`http://svc.${cluster.id}`} className={"text-md underline"}>
                    Cluster Service
                </a>
            );
        }
    };

    render = () => {
        return (
            <div className="Dev h-full w-full">
                <div className={"p-4"}>
                    <div className={"flex gap-4 pb-4"}>
                        {urls.map((url) => (
                            <a href={url.url} className={"text-md underline"}>
                                {url.title}
                            </a>
                        ))}
                        {this.clusterServiceUrl(configSignal.value?.clusters)}
                    </div>
                    <div className="flex flex-row gap-4">
                        <Button
                            title="Delete all VMs with the mows- prefix as well as their storage"
                            onClick={this.deleteAllMowsMachines}
                        >
                            Delete all MOWS virtual machines
                        </Button>
                        <div className={"flex w-[200px] gap-2"}>
                            <Input
                                placeholder="Set Config"
                                className="w-[100px]"
                                value={this.state.configToSet}
                                onChange={(value) => this.setState({ configToSet: value })}
                            />
                            <Button onClick={this.setConfig}>Set config</Button>
                        </div>
                        <Button onClick={this.createMachines}>Create virtual machines</Button>
                        <Button onClick={this.devCreateClusterFromAllMachinesInInventory}>
                            Create cluster from all machines in inventory
                        </Button>
                        <Button onClick={this.installClusterBasics}>Install Cluster Basics</Button>
                        <Button
                            title="Loads the last saved config from the browsers local storage and sets it on the manager"
                            onClick={this.loadConfigFromLocalStorage}
                        >
                            Set config from LS
                        </Button>
                        <Button
                            title="Save the current config to the browsers local storage"
                            onClick={this.saveConfigToLocalStorage}
                        >
                            Save config to LS
                        </Button>
                    </div>
                    <div className={"flex h-[400px] items-stretch gap-2 pt-4"}>
                        <div className={"h-full w-1/5 pr-4"}>
                            <pre className="box-border h-full w-full resize-none break-words rounded-lg bg-[black] p-2">
                                {JSON.stringify(configSignal.value, null, 2)}
                            </pre>
                        </div>

                        <div className="h-full w-3/5">
                            <TerminalComponent id="local" type="direct" />
                        </div>
                        <div className={"h-full w-1/5"}>
                            <Notes />
                        </div>
                    </div>
                    <div className={"pt-4"}>
                        <h1 className={"pb-4 text-2xl"}>Machines</h1>
                        <div className="flex w-full flex-col justify-start gap-4">
                            {configSignal.value?.machines &&
                                Object.entries(configSignal.value?.machines).map(
                                    ([machine_id, machine]) => {
                                        return (
                                            <MachineComponent key={machine_id} machine={machine} />
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

export default withToasterHook(Dev);
