import { signal } from "@preact/signals";
import { ClusterStatus, MachineStatus, MachineStatusResBody, ManagerConfig } from "./api-client";

export const configSignal = signal<ManagerConfig | null>(null);

export const handleConfigUpdate = async (origin: string) => {
    // create a websocket and listen for config updates
    const ws = new WebSocket(`ws://${origin}/api/config`);

    ws.onmessage = (event) => {
        const config = JSON.parse(event.data);
        configSignal.value = config;
    };

    ws.onclose = () => {
        setTimeout(() => {
            handleConfigUpdate(origin);
        }, 1000);
    };
};

export const machineStatusSignal = signal<Record<string, MachineStatus>>({});

export const handleMachineStatusUpdate = async (origin: string) => {
    const ws = new WebSocket(`ws://${origin}/api/machines/status`);

    ws.onmessage = (event) => {
        const machineStatus: MachineStatusResBody = JSON.parse(event.data);

        machineStatusSignal.value[machineStatus.id] = machineStatus.status;
    };

    ws.onclose = () => {
        setTimeout(() => {
            handleMachineStatusUpdate(origin);
        }, 1000);
    };
};

export const clusterStatusSignal = signal<Record<string, ClusterStatus>>({});

export const handleClusterStatusUpdate = async (origin: string) => {
    const ws = new WebSocket(`ws://${origin}/api/clusters/status`);

    ws.onmessage = (event) => {
        const clusterStatus: { id: string; status: ClusterStatus } = JSON.parse(event.data);

        clusterStatusSignal.value[clusterStatus.id] = clusterStatus.status;
    };

    ws.onclose = () => {
        setTimeout(() => {
            handleClusterStatusUpdate(origin);
        }, 1000);
    };
};
