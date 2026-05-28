import {
    Api,
    type ClientConfig,
    createFilezClientWithAuth,
    type FilezClient,
    type FilezUser,
    getClientConfig
} from "filez-client-typescript";
import { log } from "@my-own-web-services/react-components/lib/logging";
import { MowsProvider } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import React, { Component, createContext, type ReactNode } from "react";
import { type AuthContextProps, withAuth } from "react-oidc-context";
import { FilezActionHandlers, filezExtraActions, filezExtraDefaultHotkeys } from "../filezActions";
import { languages as filezLanguages } from "../languages";
import filezEnglishTranslation from "../languages/en-US/default";
import { themes as filezThemes } from "../themes";
import { signinRedirectSavePath } from "../utils";

export interface FilezContextType {
    readonly filezClient: FilezClient;
    readonly clientConfig: ClientConfig;
    readonly clientLoading: boolean;
    readonly clientAuthenticated: boolean;
    readonly ownFilezUser?: FilezUser | null;
}

interface FilezClientManagerProps {
    readonly children: ReactNode;
    readonly clientConfig: ClientConfig;
    readonly auth?: AuthContextProps;
}

interface FilezClientManagerState {
    readonly filezClient?: FilezClient;
    readonly ownUser?: FilezUser | null;
    readonly clientAuthenticated?: boolean;
    readonly sessionTimeoutSeconds?: number;
}

class FilezClientManagerBase extends Component<
    FilezClientManagerProps,
    FilezClientManagerState
> {
    private sessionRefreshInterval?: NodeJS.Timeout;

    constructor(props: FilezClientManagerProps) {
        super(props);
        this.state = { clientAuthenticated: false };
    }

    componentDidMount = () => {
        this.updateFilezClient();
    };

    componentDidUpdate = async (prevProps: FilezClientManagerProps) => {
        const { auth } = this.props;
        const prevAuth = prevProps.auth;

        if (auth?.user !== prevAuth?.user || auth?.isLoading !== prevAuth?.isLoading) {
            await this.updateFilezClient();
        }
    };

    componentWillUnmount = () => {
        this.clearSessionRefreshInterval();
    };

    updateFilezClient = async () => {
        if (
            this.props.auth?.user?.access_token &&
            !this.props.auth.isLoading &&
            this.props.clientConfig.serverUrl
        ) {
            const filezClient = createFilezClientWithAuth(
                this.props.clientConfig.serverUrl,
                this.props.auth.user.access_token
            );
            this.setState({ filezClient });
            log.debug(`Filez API client initialized with user token.`);

            const ownUserRes = await filezClient?.api.getOwnUser().catch(async (response) => {
                if (response?.error?.status?.Error === `IntrospectionGuardError::Inactive`) {
                    log.debug(`User token is inactive, redirecting to sign in.`);
                    if (!this.props.auth?.signinRedirect) {
                        log.error(`No signinRedirect function available in auth context.`);
                        return;
                    }
                    await signinRedirectSavePath(this.props.auth?.signinRedirect);
                }
            });

            await this.startAndSetupSessionRefresh(filezClient);

            if (ownUserRes?.data?.data?.user) {
                this.setState({ ownUser: ownUserRes?.data?.data?.user, clientAuthenticated: true });
            }
        } else {
            this.setState({
                filezClient: new Api({
                    baseUrl: this.props.clientConfig.serverUrl
                }),
                ownUser: null
            });
            this.clearSessionRefreshInterval();
        }
    };

    startAndSetupSessionRefresh = async (filezClient: FilezClient) => {
        const sessionRes = await filezClient.api.startSession({}, { credentials: `include` });
        const timeoutSeconds = sessionRes?.data?.data?.inactivity_timeout_seconds;

        if (timeoutSeconds) {
            if (this.state.sessionTimeoutSeconds !== timeoutSeconds) {
                this.setState({ sessionTimeoutSeconds: timeoutSeconds });
                log.debug(`Session timeout: ${timeoutSeconds} seconds`);
            }
            this.setupSessionRefreshInterval(filezClient, timeoutSeconds);
        } else {
            log.warn(`Session timeout not returned from startSession`);
        }
    };

    setupSessionRefreshInterval = (filezClient: FilezClient, timeoutSeconds: number) => {
        this.clearSessionRefreshInterval();
        const refreshIntervalMs = timeoutSeconds * 0.75 * 1000;

        this.sessionRefreshInterval = setInterval(async () => {
            try {
                await filezClient.api.refreshSession({}, { credentials: `include` });
            } catch (error) {
                log.error(`Failed to refresh session`, error);
            }
        }, refreshIntervalMs);
    };

    clearSessionRefreshInterval = () => {
        if (this.sessionRefreshInterval) {
            clearInterval(this.sessionRefreshInterval);
            this.sessionRefreshInterval = undefined;
        }
    };

    render = () => {
        const { children, auth, clientConfig } = this.props;
        const { filezClient } = this.state;

        const contextValue: FilezContextType = {
            filezClient: filezClient!,
            clientConfig,
            clientLoading: auth?.isLoading || !clientConfig,
            clientAuthenticated: this.state.clientAuthenticated || false,
            ownFilezUser: this.state.ownUser
        };

        return <FilezContext.Provider value={contextValue}>{children}</FilezContext.Provider>;
    };
}

export const FilezContext = createContext<FilezContextType | undefined>(undefined);

export const useFilez = (): FilezContextType => {
    const context = React.useContext(FilezContext);
    if (context === undefined) {
        throw new Error(`useFilez must be used within a FilezProvider`);
    }
    return context;
};

export const withFilez = <P extends { filez: FilezContextType }>(
    WrappedComponent: React.ComponentType<P>
): React.ComponentType<Omit<P, `filez`>> => {
    return class extends Component<Omit<P, `filez`>> {
        static contextType = FilezContext;
        declare context: React.ContextType<typeof FilezContext>;

        render = () => {
            if (this.context === undefined) {
                throw new Error(`withFilez must be used within a FilezProvider`);
            }
            const props = { ...this.props, filez: this.context } as unknown as P;
            return <WrappedComponent {...props} />;
        };
    };
};

const FilezClientManager = withAuth(FilezClientManagerBase);

interface FilezProviderProps {
    children: ReactNode;
}

interface FilezProviderState {
    clientConfig: ClientConfig | null;
}

export class FilezProvider extends Component<FilezProviderProps, FilezProviderState> {
    constructor(props: FilezProviderProps) {
        super(props);
        this.state = { clientConfig: null };
    }

    componentDidMount = () => {
        getClientConfig()
            .then((config) => this.setState({ clientConfig: config }))
            .catch((error) => log.error(`Failed to fetch OIDC config`, error));
    };

    render = () => {
        const { clientConfig } = this.state;
        const { children } = this.props;

        if (!clientConfig) {
            return <div>Loading Configuration...</div>;
        }

        return (
            <MowsProvider
                storagePrefix={`filez`}
                oidc={{
                    issuerUrl: clientConfig.oidcIssuerUrl,
                    clientId: clientConfig.oidcClientId,
                    scope: `openid profile email urn:zitadel:iam:org:project:id:zrc-mows-cloud-filez-filez-auth:aud`
                }}
                themes={filezThemes}
                languages={filezLanguages}
                initialTranslation={filezEnglishTranslation}
                extraActions={filezExtraActions}
                extraDefaultHotkeys={filezExtraDefaultHotkeys}
            >
                <FilezActionHandlers />
                <FilezClientManager clientConfig={clientConfig}>{children}</FilezClientManager>
            </MowsProvider>
        );
    };
}
