import { Api, StorageQuotaSubjectType, type FilezUser, type StorageQuota } from "./api-client";

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

export const impersonateUser = (userId: string) => {
    return {
        "X-Filez-Impersonate-User": userId
    };
};

export const defaultAppId = "00000000-0000-0000-0000-000000000000";

export const createFilezClientWithAuth = (serverUrl: string, bearer_token: string) => {
    if (!serverUrl) {
        throw new Error("Server URL is required to create Filez client");
    }

    return new Api({
        baseUrl: serverUrl,
        baseApiParams: { secure: true },
        securityWorker: async () => ({
            // https://github.com/acacode/swagger-typescript-api/issues/300
            headers: {
                ...(bearer_token
                    ? {
                          Authorization: `Bearer ${bearer_token}`
                      }
                    : {})
            }
        })
    });
};

export const createExampleUser = async (filezClient: Api<unknown>): Promise<FilezUser> => {
    const email = `example-${Date.now()}@example.com`;
    const user = await filezClient.api.createUser({ email });
    if (!user.data?.data) {
        throw new Error("Failed to create example user");
    }
    console.log(`Created example user: ${email} (${user.data.data.created_user.id})`);
    return user.data.data.created_user;
};

export const createDefaultStorageQuotaForUser = async (
    filezClient: Api<unknown>,
    user: FilezUser,
    quotaBytes: number = 10_000_000
): Promise<StorageQuota> => {
    const storage_locations = (await filezClient.api.listStorageLocations({})).data?.data
        ?.storage_locations;

    if (storage_locations?.length === 0) {
        throw new Error("No storage locations found. Please create a storage location first.");
    } else if (storage_locations?.length !== undefined && storage_locations?.length > 1) {
        console.warn("Multiple storage locations found. Using the first one.");
    }

    const storage_location_id = storage_locations?.[0].id;

    if (!storage_location_id) {
        throw new Error("No storage location ID found. Please create a storage location first.");
    }

    const storage_quota = (
        await filezClient.api.createStorageQuota({
            storage_quota_bytes: quotaBytes,
            storage_quota_subject_type: StorageQuotaSubjectType.User,
            storage_quota_subject_id: user.id,
            storage_location_id,
            storage_quota_name: `${user.id}'s Storage Quota`
        })
    ).data?.data?.created_storage_quota;

    if (!storage_quota) {
        throw new Error("Failed to create storage quota for user.");
    }

    return storage_quota;
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
