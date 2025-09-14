import {
    Api,
    ClientConfig,
    createFilezClientWithAuth,
    FilezClient,
    getClientConfig
} from "filez-client-typescript";
import { User, WebStorageStateStore } from "oidc-client-ts";
import React, { Component, createContext, ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { AuthContextProps, AuthProvider, withAuth } from "react-oidc-context";
import { CustomProvider as ReactSuiteProvider } from "rsuite";
//import { generateDndPreview } from "./components/dragAndDrop/generatePreview";

export interface FilezContextType {
    readonly auth: AuthContextProps;
    readonly filezClient: FilezClient;
    readonly clientConfig: ClientConfig;
    readonly isLoading: boolean;
}

// Create the context. An undefined default value ensures a provider is always used.
export const FilezContext = createContext<FilezContextType | undefined>(undefined);

// Helper HOC to consume the context in class components
export const withFilez = <P extends object>(
    WrappedComponent: React.ComponentType<P & { filez: FilezContextType }>
) => {
    return class extends Component<P> {
        static contextType = FilezContext;
        declare context: React.ContextType<typeof FilezContext>;

        render = () => {
            if (this.context === undefined) {
                throw new Error("withFilez must be used within a FilezProvider");
            }
            return <WrappedComponent {...this.props} filez={this.context} />;
        };
    };
};

// For functional components, keep the hook
export const useFilez = (): FilezContextType => {
    const context = React.useContext(FilezContext);
    if (context === undefined) {
        throw new Error("useFilez must be used within a FilezProvider");
    }
    return context;
};

interface FilezClientManagerProps {
    children: ReactNode;
    clientConfig: ClientConfig;
    auth?: AuthContextProps;
}

interface FilezClientManagerState {
    filezClient: FilezClient | null;
}

// Internal component to manage the client lifecycle after auth is ready.
class FilezClientManagerBase extends Component<FilezClientManagerProps, FilezClientManagerState> {
    constructor(props: FilezClientManagerProps) {
        super(props);
        this.state = {
            filezClient: null
        };
    }

    componentDidMount = () => {
        this.updateFilezClient();
    };

    componentDidUpdate = (prevProps: FilezClientManagerProps) => {
        const { auth } = this.props;
        const prevAuth = prevProps.auth;

        if (auth?.user !== prevAuth?.user || auth?.isLoading !== prevAuth?.isLoading) {
            this.updateFilezClient();
        }
    };

    updateFilezClient = () => {
        // Effect to create or destroy the filezClient based on auth state.
        if (
            this.props.auth?.user &&
            !this.props.auth.isLoading &&
            this.props.clientConfig.serverUrl
        ) {
            const client = createFilezClientWithAuth(
                this.props.clientConfig.serverUrl,
                this.props.auth.user.access_token
            );
            this.setState({ filezClient: client });

            console.log("Filez API client initialized with user token.");

            // Verify the token is active, otherwise force a new sign-in.
            client.api.getOwnUser().catch(async (response) => {
                if (response?.error?.status?.Error === "IntrospectionGuardError::Inactive") {
                    console.error("User token is inactive, redirecting to sign in.");
                    localStorage.setItem("redirect_uri", window.location.href);
                    await this.props.auth?.signinRedirect();
                }
            });
        } else {
            // User is not authenticated, ensure the client is null.
            this.setState({
                filezClient: new Api({
                    baseUrl: this.props.clientConfig.serverUrl
                })
            });
        }
    };

    render = () => {
        const { children, auth, clientConfig } = this.props;
        const { filezClient } = this.state;

        const contextValue: FilezContextType = {
            auth: auth!,
            filezClient: filezClient!,
            clientConfig,
            isLoading: auth?.isLoading || !clientConfig
        };

        return <FilezContext.Provider value={contextValue}>{children}</FilezContext.Provider>;
    };
}

// Wrap FilezClientManagerBase with auth context
const FilezClientManager = withAuth(FilezClientManagerBase);

interface FilezProviderProps {
    children: ReactNode;
}

interface FilezProviderState {
    clientConfig: ClientConfig | null;
}

// The main provider component exported for use in the app.
export class FilezProvider extends Component<FilezProviderProps, FilezProviderState> {
    constructor(props: FilezProviderProps) {
        super(props);
        this.state = {
            clientConfig: null
        };
    }

    componentDidMount = () => {
        // Fetch client configuration on component mount.
        getClientConfig()
            .then((config) => {
                this.setState({ clientConfig: config });
            })
            .catch((error) => {
                console.error("Failed to fetch OIDC config", error);
                // Consider rendering an error message to the user.
            });
    };

    onSigninCallback = (_user: User | void): void => {
        const redirectUri = localStorage.getItem("filez_redirect_uri");
        localStorage.removeItem("filez_redirect_uri");
        // Restore the original path the user was trying to access.
        window.history.replaceState({}, document.title, redirectUri || window.location.pathname);
    };

    render = () => {
        const { clientConfig } = this.state;
        const { children } = this.props;

        // Display a loading state until the configuration is fetched.
        // This prevents AuthProvider from initializing with invalid config.
        if (!clientConfig) {
            return <div>Loading Configuration...</div>;
        }

        const oidcConfig = {
            userStore: new WebStorageStateStore({ store: window.localStorage }),
            authority: clientConfig.oidcIssuerUrl,
            client_id: clientConfig.oidcClientId,
            redirect_uri: window.location.origin + "/auth/callback",
            response_type: "code",
            scope: "openid profile email urn:zitadel:iam:org:project:id:zrc-mows-cloud-filez-filez-auth:aud",
            post_logout_redirect_uri: window.location.origin,
            response_mode: "query",
            automaticSilentRenew: true,
            onSigninCallback: this.onSigninCallback
        };

        return (
            <AuthProvider {...oidcConfig}>
                <ReactSuiteProvider theme="dark">
                    <DndProvider backend={HTML5Backend}>
                        <FilezClientManager clientConfig={clientConfig}>
                            {children}
                        </FilezClientManager>
                    </DndProvider>
                </ReactSuiteProvider>
            </AuthProvider>
        );
    };
}
//                     <DndPreview generator={generateDndPreview} />
