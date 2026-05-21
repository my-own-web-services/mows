import { effect } from "@preact/signals-react";
import CodeViewer from "mows-components-react/components/code/codeViewer/CodeViewer";
import { Button } from "mows-components-react/components/ui/button";
import { Input } from "mows-components-react/components/ui/input";
import { MowsContext } from "mows-components-react/lib/mowsContext/MowsContext";
import { PureComponent } from "react";
import { IoCloudDownload, IoCloudUpload } from "react-icons/io5";
import {
    Api,
    ApiResponseStatus,
    Cluster,
    HttpResponse,
    MachineCreationReqBody,
    MachineCreationReqType,
    MachineType,
    ManagerConfig,
    PublicIpCreationConfig
} from "../api-client";
import { clusterStatusSignal, configSignal, machineStatusSignal } from "../config";
import { notifyError, notifySuccess } from "../utils";
import Notes from "./Notes";
import TabbedTerminal from "./TabbedTerminal";
import ClusterComp from "./cluster/ClusterComp";
import MachineComponent from "./machine/Machine";

const urls: Url[] = [
    {
        url: `http://localhost:16686/search?service=manager`,
        title: `Jaeger`,
        category: [`manager`]
    },
    {
        url: `http://localhost:8001/api/v1/namespaces/mows-core-network-cilium/services/http:hubble-ui:http/proxy/`,
        title: `Hubble/Cilium/Network`,
        category: [`cluster`]
    },
    {
        url: `https://editor.networkpolicy.io/`,
        title: `Cilium Network Policy Editor`,
        category: [`cluster`]
    },
    {
        url: `http://localhost:8001/api/v1/namespaces/mows-core-storage-longhorn/services/http:longhorn-frontend:http/proxy/`,
        title: `Longhorn/Storage`,
        category: [`cluster`]
    },
    {
        url: `http://localhost:8001/api/v1/namespaces/mows-dev-k8s-dashboard/services/https:mows-dev-k8s-dashboard-kubernetes-dashboard:443/proxy/`,
        title: `K8s Dashboard`,
        category: [`cluster`]
    },
    {
        url: `http://localhost:8001/api/v1/namespaces/mows-monitoring/services/http:mows-monitoring-grafana:80/proxy/`,
        title: `Grafana/Monitoring`,
        category: [`cluster`],
        notes: `user: admin, password: prom-operator`
    },
    {
        url: `http://localhost:8001/api/v1/namespaces/mows-monitoring/services/http:mows-monitoring-kube-prome-prometheus:9090/proxy/`,
        title: `Prometheus`,
        category: [`cluster`]
    },
    {
        url: `http://localhost:8001/api/v1/namespaces/mows-police/services/http:policy-reporter-ui:http/proxy/`,
        title: `Policy Reporter`,
        category: [`cluster`]
    },
    {
        url: `http://localhost:8001/api/v1/namespaces/mows-core-gitea/services/http:mows-core-gitea-http:http/proxy/`,
        title: `Gitea`,
        category: [`cluster`]
    },
    {
        url: `http://localhost:8001/api/v1/namespaces/mows-core-argocd/services/http:mows-core-argocd-server:http/proxy/`,
        title: `ArgoCD`,
        category: [`cluster`],
        notes: `user: admin, password: can be found with command in notes`
    }
];

interface DevProps {
    readonly client: Api<unknown>;
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

export default class Dev extends PureComponent<DevProps, DevState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;
    private disposeSignalEffect: (() => void) | null = null;

    constructor(props: DevProps) {
        super(props);
        this.state = {
            configToSet: ``
        };
    }

    componentDidMount = () => {
        let isFirstRun = true;
        this.disposeSignalEffect = effect(() => {
            // Subscribe to every signal this component renders against so that
            // class components (which the signals-react babel transform doesn't
            // touch) actually re-render on signal changes.
            void configSignal.value;
            void machineStatusSignal.value;
            void clusterStatusSignal.value;
            if (isFirstRun) {
                isFirstRun = false;
                return;
            }
            this.forceUpdate();
        });
    };

    componentWillUnmount = () => {
        this.disposeSignalEffect?.();
    };

    handleApiCall = async (apiCall: () => Promise<HttpResponse<any>>) => {
        try {
            const { data } = await apiCall();
            if (data.status === ApiResponseStatus.Success) {
                notifySuccess(data.status, data.message);
            } else {
                notifyError(data.status, data.message);
            }
        } catch (error: any) {
            notifyError(`Error`, error?.message ?? String(error));
        }
    };

    devCreateMachines = async () => {
        const machines: MachineCreationReqType[] = Array(3).fill({
            LocalQemu: { memory: 16, cpus: 4 }
        });
        const creation_config: MachineCreationReqBody = { machines };
        await this.handleApiCall(() => this.props.client.api.createMachines(creation_config));
    };

    devCreateHcloudMachine = async () => {
        const creation_config: MachineCreationReqBody = {
            machines: [
                {
                    ExternalHcloud: { server_type: `cx22`, location: `nbg1` }
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
        const mb_config = localStorage.getItem(`config`);
        if (mb_config) {
            const config: ManagerConfig = JSON.parse(mb_config);
            configSignal.value = config;
            await this.handleApiCall(() => this.props.client.api.updateConfig(config));
        }
    };

    saveConfigToLocalStorage = () => {
        localStorage.setItem(`config`, JSON.stringify(configSignal.value));
        notifySuccess(this.context!.t.manager.dev.config.saved);
    };

    installClusterBasics = async () => {
        await this.handleApiCall(() => this.props.client.api.devInstallClusterBasics());
    };

    clusterServiceUrl = (clusters: Partial<Record<string, Cluster>> | undefined) => {
        for (const [, cluster] of Object.entries(clusters || {})) {
            if (!cluster) continue;
            return (
                <a
                    href={`http://svc.${cluster.id}`}
                    className={`text-sm text-muted-foreground hover:text-foreground hover:underline`}
                >
                    Cluster Service
                </a>
            );
        }
    };

    devCreateStaticIp = async () => {
        const machines = configSignal.value?.machines;
        if (!machines) return;
        const hcloudEntry = Object.entries(machines).find(
            ([, machine]) => machine?.machine_type === MachineType.ExternalHcloud
        );
        if (!hcloudEntry) return;
        const machine_id = hcloudEntry[0];

        const clusters = configSignal.value?.clusters;
        if (!clusters) return;

        const cluster = Object.entries(clusters)[0]?.[1];
        if (!cluster) return;

        const creation_config: PublicIpCreationConfig = {
            cluster_id: cluster.id,
            creation_type: {
                MachineProxy: [machine_id, cluster.id]
            }
        };

        await this.handleApiCall(() => this.props.client.api.createPublicIp(creation_config));
    };

    render = () => {
        const t = this.context!.t.manager;
        return (
        <div className={`Dev flex flex-col gap-8`}>
            <div>
                <div className={`flex items-baseline gap-4`}>
                    <h1 className={`text-3xl`}>{t.dev.sections.manager}</h1>
                    <div className={`flex gap-4`}>
                        {urls.flatMap((url) =>
                            url.category.includes(`manager`) ? (
                                <a
                                    key={url.url}
                                    href={url.url}
                                    className={`text-sm text-muted-foreground hover:text-foreground hover:underline`}
                                >
                                    {url.title}
                                </a>
                            ) : (
                                []
                            )
                        )}
                    </div>
                </div>
                <div className={`flex h-[400px] items-stretch gap-2 pt-4`}>
                    <div className={`flex w-1/5 flex-col gap-2 overflow-hidden`}>
                        <div className={`flex-grow overflow-auto`}>
                            <CodeViewer
                                className={`h-full max-h-full w-full`}
                                language={`json`}
                                code={JSON.stringify(configSignal.value, null, 2)}
                                wrap
                                showLineNumbers
                            />
                        </div>
                        <div className={`flex flex-col gap-2`}>
                            <Button variant={`secondary`}
                                title={t.dev.config.setFromLsTitle}
                                onClick={this.loadConfigFromLocalStorage}
                                size={`sm`}
                            >
                                <IoCloudUpload />
                                {t.dev.config.setFromLs}
                            </Button>
                            <Button variant={`secondary`}
                                title={t.dev.config.saveToLsTitle}
                                onClick={this.saveConfigToLocalStorage}
                                size={`sm`}
                            >
                                <IoCloudDownload />
                                {t.dev.config.saveToLs}
                            </Button>
                            <Input
                                placeholder={t.dev.config.placeholder}
                                value={this.state.configToSet}
                                onChange={(e) =>
                                    this.setState({ configToSet: e.currentTarget.value })
                                }
                            />
                            <Button variant={`secondary`} size={`sm`} onClick={this.setConfig}>
                                <IoCloudUpload />
                                {t.dev.config.setConfig}
                            </Button>
                        </div>
                    </div>

                    <div className={`h-full w-3/5`}>
                        <TabbedTerminal
                            defaultTerminalId={`manager`}
                            defaultTitle={t.dev.sections.manager}
                        />
                    </div>
                    <div className={`h-full w-1/5`}>
                        <Notes className={`h-full`} />
                    </div>
                </div>
            </div>
            <div>
                <div className={`flex items-baseline gap-4`}>
                    <h1 className={`pb-4 text-3xl font-bold`}>{t.dev.sections.clusters}</h1>
                    <div className={`flex gap-4 pb-4`}>
                        {urls.flatMap((url) =>
                            url.category.includes(`cluster`) ? (
                                <a
                                    key={url.url}
                                    href={url.url}
                                    className={`text-sm text-muted-foreground hover:text-foreground hover:underline`}
                                >
                                    {url.title}
                                </a>
                            ) : (
                                []
                            )
                        )}
                        {this.clusterServiceUrl(configSignal.value?.clusters)}
                    </div>
                </div>
                <div className={`flex`}>
                    {configSignal.value?.clusters &&
                        Object.entries(configSignal.value.clusters).map(([id, cluster]) => {
                            if (!cluster) return null;
                            return (
                                <ClusterComp
                                    key={id}
                                    cluster={cluster}
                                    client={this.props.client}
                                />
                            );
                        })}
                </div>
            </div>
            <div>
                <div className={`flex items-baseline gap-4`}>
                    <h1 className={`pb-4 text-3xl font-bold`}>{t.dev.sections.machines}</h1>
                </div>
                <div className={`flex flex-row flex-wrap gap-2`}>
                    <Button
                        title={t.dev.actions.deleteAllMowsVmsTitle}
                        onClick={this.deleteAllMowsMachines}
                        size={`sm`}
                        variant={`destructive`}
                    >
                        {t.dev.actions.deleteAllMowsVms}
                    </Button>
                    <Button variant={`secondary`} size={`sm`} onClick={this.devCreateMachines}>
                        {t.dev.actions.create3LocalVms}
                    </Button>
                    <Button variant={`secondary`} size={`sm`} onClick={this.devCreateClusterFromAllMachinesInInventory}>
                        {t.dev.actions.createClusterFromInventory}
                    </Button>
                    <Button variant={`secondary`} size={`sm`} onClick={this.installClusterBasics}>
                        {t.dev.actions.installClusterBasics}
                    </Button>
                    <Button variant={`secondary`}
                        size={`sm`}
                        title={t.dev.actions.createHcloudMachineTitle}
                        onClick={this.devCreateHcloudMachine}
                    >
                        {t.dev.actions.createHcloudMachine}
                    </Button>
                    <Button variant={`secondary`}
                        size={`sm`}
                        title={t.dev.actions.createStaticIpTitle}
                        onClick={this.devCreateStaticIp}
                    >
                        {t.dev.actions.createStaticIp}
                    </Button>
                </div>
                <div className={`flex w-full flex-col justify-start gap-4 pt-4`}>
                    {configSignal.value?.machines &&
                        Object.entries(configSignal.value.machines)
                            .sort()
                            .map(([machine_id, machine]) => {
                                if (!machine) return null;
                                return (
                                    <MachineComponent
                                        client={this.props.client}
                                        machineStatus={machineStatusSignal.value[machine_id]}
                                        key={machine_id}
                                        machine={machine}
                                    />
                                );
                            })}
                </div>
            </div>
        </div>
        );
    };
}
