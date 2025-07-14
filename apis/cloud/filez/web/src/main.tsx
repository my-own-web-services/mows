import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import { User, WebStorageStateStore } from "oidc-client-ts";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { AuthProvider } from "react-oidc-context";
import App from "./App.tsx";
import "./index.css";
import { ClientConfig, getClientConfig } from "./utils.ts";

const onSigninCallback = (_user: User | void): void => {
    window.history.replaceState({}, document.title, window.location.pathname);
};

const AuthProviderWrapper = () => {
    const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const clientConfig = await getClientConfig();
                setClientConfig(clientConfig);
            } catch (error) {
                console.error("Failed to fetch OIDC config", error);
                // Handle error appropriately, maybe render an error message
            }
        };

        fetchConfig();
    }, []);

    if (!clientConfig) {
        // You can render a loading indicator here
        return <></>;
    }

    return (
        <AuthProvider
            {...{
                userStore: new WebStorageStateStore({ store: window.localStorage }),
                authority: clientConfig.oidcIssuerUrl,
                client_id: clientConfig.oidcClientId,
                redirect_uri: window.location.origin + "/auth/callback",
                response_type: "code",
                scope: "openid profile email urn:zitadel:iam:org:project:id:zrc-mows-cloud-filez-filez-auth:aud",
                post_logout_redirect_uri: window.location.origin,
                response_mode: "query",
                automaticSilentRenew: true,
                onSigninCallback
            }}
        >
            <App serverUrl={clientConfig.serverUrl} />
        </AuthProvider>
    );
};

render(<AuthProviderWrapper />, document.getElementById("root")!);
