import { signal } from "@preact/signals";
import { MachineStatus, MachineStatusResBody, ManagerConfig } from "./api-client";

export const configSignal = signal<ManagerConfig | null>(null);

export const handleConfigUpdate = async () => {
    // create a websocket and listen for config updates
    const ws = new WebSocket(`ws://localhost:3000/api/config`);

    ws.onmessage = (event) => {
        const config = JSON.parse(event.data);
        configSignal.value = config;
    };

    ws.onclose = () => {
        setTimeout(() => {
            handleConfigUpdate();
        }, 1000);
    };
};

export const machineStatusSignal = signal<Record<string, MachineStatus>>({});

export const handleMachineStatusUpdate = async () => {
    const ws = new WebSocket(`ws://localhost:3000/api/machines/status`);

    ws.onmessage = (event) => {
        const machineStatus: MachineStatusResBody = JSON.parse(event.data);

        machineStatusSignal.value[machineStatus.id] = machineStatus.status;
    };

    ws.onclose = () => {
        setTimeout(() => {
            handleMachineStatusUpdate();
        }, 1000);
    };
};
