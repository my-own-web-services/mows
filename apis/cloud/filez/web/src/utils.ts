interface ClientConfig {
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
