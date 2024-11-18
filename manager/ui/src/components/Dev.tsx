import { Component } from "preact/compat";
import { IoCloudDownload, IoCloudUpload } from "react-icons/io5";
import { Button, Input, InputGroup, Message, useToaster } from "rsuite";
import { ToastContainerProps } from "rsuite/esm/toaster/ToastContainer";
import {
    Api,
    ApiResponse,
    ApiResponseStatus,
    Cluster,
    HttpResponse,
    MachineCreationReqBody,
    MachineCreationReqType,
    MachineType,
    ManagerConfig,
    PublicIpCreationConfig
} from "../api-client";
import { configSignal, machineStatusSignal } from "../config";
import { withToasterHook } from "../utils";
import Notes from "./Notes";
import TerminalComponent from "./Terminal";
import MachineComponent from "./machine/Machine";

const urls: Url[] = [
    {
        url: "http://localhost:16686/search?service=manager",
        title: "Jaeger",
        category: ["manager"]
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-core-network-cilium/services/http:hubble-ui:http/proxy/",
        title: "Hubble/Cilium/Network",
        category: ["cluster"]
    },
    {
        url: "https://editor.networkpolicy.io/",
        title: "Cilium Network Policy Editor",
        category: ["cluster"]
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-core-storage-longhorn/services/http:longhorn-frontend:http/proxy/",
        title: "Longhorn/Storage",
        category: ["cluster"]
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-dev-k8s-dashboard/services/https:mows-dev-k8s-dashboard-kubernetes-dashboard:443/proxy/",
        title: "K8s Dashboard",
        category: ["cluster"]
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-monitoring/services/http:mows-monitoring-grafana:80/proxy/",
        title: "Grafana/Monitoring",
        category: ["cluster"],
        notes: "user: admin, password: prom-operator"
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-monitoring/services/http:mows-monitoring-kube-prome-prometheus:9090/proxy/",
        title: "Prometheus",
        category: ["cluster"]
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-police/services/http:policy-reporter-ui:http/proxy/",
        title: "Policy Reporter",
        category: ["cluster"]
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-core-gitea/services/http:mows-core-gitea-http:http/proxy/",
        title: "Gitea",
        category: ["cluster"]
    },
    {
        url: "http://localhost:8001/api/v1/namespaces/mows-core-argocd/services/https:mows-core-argocd-server:https/proxy/",
        title: "ArgoCD",
        category: ["cluster"],
        notes: "user: admin, password: can be found with command in notes"
    }
];

interface DevProps {
    readonly client: Api<unknown>;
    readonly toaster: ReturnType<typeof useToaster>;
}

interface DevState {
    readonly configToSet: string;
}

interface Url {
    url: string;
    title: string;
    category: string[];
    notes?: string;
}

const toastParams: ToastContainerProps = { placement: "bottomEnd", duration: 10000 };

export default withToasterHook(
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

        devCreateMachines = async () => {
            let machines: MachineCreationReqType[] = Array(3).fill({
                LocalQemu: { memory: 4, cpus: 2 }
            });
            let creation_config: MachineCreationReqBody = {
                machines
            };
            await this.handleApiCall(() => this.props.client.api.createMachines(creation_config));
        };

        devCreateHcloudMachine = async () => {
            let creation_config: MachineCreationReqBody = {
                machines: [
                    {
                        ExternalHcloud: { server_type: "cx22", location: "nbg1" }
                    }
                ]
            };
            await this.handleApiCall(() => this.props.client.api.createMachines(creation_config));
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

        devCreateStaticIp = async () => {
            const machines = configSignal.value?.machines;
            if (!machines) {
                return;
            }
            const machine_id = Object.entries(machines).filter(
                ([_, machine]) => machine.machine_type === MachineType.ExternalHcloud
            )[0][0];

            const clusters = configSignal.value?.clusters;

            if (!clusters) {
                return;
            }

            const cluster = Object.entries(clusters)[0][1];

            const creation_config: PublicIpCreationConfig = {
                cluster_id: cluster.id,
                creation_type: {
                    MachineProxy: [machine_id, cluster.id]
                }
            };

            await this.handleApiCall(() => this.props.client.api.createPublicIp(creation_config));
        };

        render = () => {
            const size = "sm";
            return (
                <div className="Dev flex flex-col gap-8">
                    <div>
                        <div className={"flex items-baseline gap-4"}>
                            <h1 className={"text-3xl"}>Manager</h1>
                            <div className={"flex gap-4"}>
                                {urls.flatMap((url) => {
                                    if (url.category.includes("manager")) {
                                        return (
                                            <a href={url.url} className={"text-md underline"}>
                                                {url.title}
                                            </a>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                        <div className={"flex h-[400px] items-stretch gap-2 pt-4"}>
                            <div className={"flex w-1/5 flex-col gap-2 overflow-hidden"}>
                                <div className={"flex-grow overflow-auto"}>
                                    <pre className="box-border h-full max-h-full w-full resize-none break-words rounded-lg bg-[black] p-2">
                                        {JSON.stringify(configSignal.value, null, 2)}
                                    </pre>
                                </div>
                                <div className={"flex flex-col gap-2"}>
                                    <div className={"flex flex-grow gap-2"}>
                                        <Button
                                            title="Load the last saved cluster config from the browsers local storage and set it on the manager"
                                            onClick={this.loadConfigFromLocalStorage}
                                            endIcon={<IoCloudUpload />}
                                            className="flex-grow"
                                            size={size}
                                        >
                                            Set config from LS
                                        </Button>
                                        <Button
                                            title="Save the current cluster config to the browsers local storage"
                                            onClick={this.saveConfigToLocalStorage}
                                            endIcon={<IoCloudDownload />}
                                            className="flex-grow"
                                            size={size}
                                        >
                                            Save config to LS
                                        </Button>
                                    </div>
                                    <div className={"flex w-full gap-2"}>
                                        <InputGroup>
                                            <Input
                                                placeholder="Config to set"
                                                className="flex-grow"
                                                value={this.state.configToSet}
                                                onChange={(value: any) =>
                                                    this.setState({ configToSet: value })
                                                }
                                                size={size}
                                            />
                                            <InputGroup.Button
                                                size={size}
                                                className="w-30"
                                                onClick={this.setConfig}
                                                endIcon={<IoCloudUpload />}
                                            >
                                                Set config
                                            </InputGroup.Button>
                                        </InputGroup>
                                    </div>
                                </div>
                            </div>

                            <div className="h-full w-3/5">
                                <TerminalComponent id="local" type="direct" />
                            </div>
                            <div className={"h-full w-1/5"}>
                                <Notes className="h-full" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className={"flex items-baseline gap-4"}>
                            <h1 className={"pb-4 text-3xl font-bold"}>Machines</h1>

                            <div className={"flex gap-4 pb-4"}>
                                {urls.flatMap((url) => {
                                    if (url.category.includes("cluster")) {
                                        return (
                                            <a href={url.url} className={"text-md underline"}>
                                                {url.title}
                                            </a>
                                        );
                                    }
                                })}
                                {this.clusterServiceUrl(configSignal.value?.clusters)}
                            </div>
                        </div>
                        <div className="flex flex-row flex-wrap gap-2">
                            <Button
                                title="Delete all VMs with the 'mows-' prefix as well as their storage"
                                onClick={this.deleteAllMowsMachines}
                                size={size}
                            >
                                Delete all MOWS local VMs
                            </Button>

                            <Button size={size} onClick={this.devCreateMachines}>
                                Create 3 local VMs
                            </Button>
                            <Button
                                size={size}
                                onClick={this.devCreateClusterFromAllMachinesInInventory}
                            >
                                Create cluster from all local machines in inventory
                            </Button>
                            <Button size={size} onClick={this.installClusterBasics}>
                                Install Cluster Basics
                            </Button>

                            <Button
                                size={size}
                                title="Create a machine on hcloud, HCLOUD_API_TOKEN must be set in secrets.env"
                                onClick={this.devCreateHcloudMachine}
                            >
                                Create hcloud machine
                            </Button>
                            <Button
                                size={size}
                                title="Creates a static machine from an EXISTING hcloud machine in inventory"
                                onClick={this.devCreateStaticIp}
                            >
                                Create static IP from hcloud machine
                            </Button>
                        </div>
                        <div className="flex w-full flex-col justify-start gap-4 pt-4">
                            {configSignal.value?.machines &&
                                Object.entries(configSignal.value?.machines).map(
                                    ([machine_id, machine]) => {
                                        return (
                                            <MachineComponent
                                                machineStatus={
                                                    machineStatusSignal.value[machine_id]
                                                }
                                                key={machine_id}
                                                machine={machine}
                                            />
                                        );
                                    }
                                )}
                        </div>
                    </div>
                </div>
            );
        };
    }
);
