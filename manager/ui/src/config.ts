import { signal } from "@preact/signals";
import { MachineStatus, ManagerConfig } from "./api-client";

export const configSignal = signal<ManagerConfig | null>(null);

export const handleConfigUpdate = async () => {
    // create a websocket and listen for config updates
    const ws = new WebSocket(`ws://localhost:3000/api/config`);

    ws.onmessage = (event) => {
        const config = JSON.parse(event.data);
        configSignal.value = config;
    };
};

export const machineStatusSignal = signal<Record<string, string>>({});

export const handleMachineStatusUpdate = async () => {
    const ws = new WebSocket(`ws://localhost:3000/api/machines/status`);

    ws.onmessage = (event) => {
        const machineStatus: MachineStatus = JSON.parse(event.data);

        machineStatusSignal.value[machineStatus.id] = machineStatus.status;
    };
};
