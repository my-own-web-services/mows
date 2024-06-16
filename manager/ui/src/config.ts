import { signal } from "@preact/signals";
import { Api, ManagerConfig } from "./api-client";

export const configSignal = signal<ManagerConfig | null>(null);

export const reloadConfig = async () => {
    const client = new Api({ baseUrl: "http://localhost:3000" });
    const config = (await client.api.getConfig()).data;
    configSignal.value = config;
};
