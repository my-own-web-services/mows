import { AuthState } from "react-oidc-context";
import { Api } from "./api-client";

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

export const impersonateUser = (userId: string) => {
    return {
        "X-Filez-Impersonate-User": userId
    };
};

export const createFilezClient = (serverUrl: string, auth?: AuthState) => {
    return new Api({
        baseUrl: serverUrl,
        baseApiParams: { secure: true },
        securityWorker: async () => ({
            // https://github.com/acacode/swagger-typescript-api/issues/300
            headers: {
                ...(auth?.user?.access_token
                    ? {
                          Authorization: `Bearer ${auth?.user?.access_token}`
                      }
                    : {})
            }
        })
    });
};

export const getBlobSha256Digest = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            const hashBuffer = crypto.subtle.digest("SHA-256", arrayBuffer);
            hashBuffer
                .then((hash) => {
                    const hashArray = Array.from(new Uint8Array(hash));
                    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
                    resolve(hashHex);
                })
                .catch(reject);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
};
