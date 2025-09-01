export interface ClientConfig {
    serverUrl: string;
    oidcClientId: string;
    oidcIssuerUrl: string;
}

export const getClientConfig = async (): Promise<ClientConfig> => {
    const clientConfig = localStorage.getItem("clientConfig");

    if (clientConfig) {
        fetchAndUpdateClientConfig();

        return JSON.parse(clientConfig) as ClientConfig;
    } else {
        return await fetchAndUpdateClientConfig();
    }
};

export const fetchAndUpdateClientConfig = async (): Promise<ClientConfig> => {
    const response = await fetch("/client-config.json");
    if (!response.ok) {
        throw new Error("Failed to fetch client configuration");
    }
    const config: ClientConfig = await response.json();
    localStorage.setItem("clientConfig", JSON.stringify(config));
    return config;
};

export const logSuccess = (message: string) => {
    console.log(`%c${message}`, "color: lime; font-weight: bold; font-size: 1.5em;");
};

export const logError = (message: string) => {
    console.error(`%c${message}`, "color: red; font-weight: bold; font-size: 1.5em;");
};
