import {
    Api,
    ClientConfig,
    createFilezClientWithAuth,
    FilezClient,
    FilezUser,
    getClientConfig
} from "filez-client-typescript";
import { User, WebStorageStateStore } from "oidc-client-ts";
import React, { Component, createContext, ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { I18nextProvider } from "react-i18next";
import { AuthContextProps, AuthProvider, withAuth } from "react-oidc-context";
import i18n from "./lib/i18n";
import { FilezTheme, themeLocalStorageKey, themePrefix, themes } from "./lib/themes";
import { filezPostLoginRedirectPathLocalStorageKey } from "./lib/utils";
import { loadThemeCSS } from "./utils";
//import { generateDndPreview } from "./components/dragAndDrop/generatePreview";

export interface FilezContextType {
    readonly auth: AuthContextProps;
    readonly filezClient: FilezClient;
    readonly clientConfig: ClientConfig;
    readonly clientLoading: boolean;
    readonly setTheme: (theme: FilezTheme) => Promise<void>;
    readonly currentTheme: FilezTheme;
    readonly ownFilezUser?: FilezUser | null;
}

export const FilezContext = createContext<FilezContextType | undefined>(undefined);

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

// Undefined means still loading, null means no user, otherwise a user.
interface FilezClientManagerState {
    filezClient?: FilezClient;
    currentTheme: FilezTheme;
    ownUser?: FilezUser | null;
}

class FilezClientManagerBase extends Component<FilezClientManagerProps, FilezClientManagerState> {
    constructor(props: FilezClientManagerProps) {
        super(props);
        const currentThemeId = localStorage.getItem(themeLocalStorageKey) || "system";
        console.log("Current theme ID:", currentThemeId);

        this.state = {
            currentTheme: themes.find((t) => t.id === currentThemeId) || themes[0]
        };
    }

    componentDidMount = () => {
        this.updateFilezClient();
        this.setTheme(this.state.currentTheme);
    };

    componentDidUpdate = async (prevProps: FilezClientManagerProps) => {
        const { auth } = this.props;
        const prevAuth = prevProps.auth;

        if (auth?.user !== prevAuth?.user) {
            this.restoreRedirectPath();
        }

        if (auth?.user !== prevAuth?.user || auth?.isLoading !== prevAuth?.isLoading) {
            await this.updateFilezClient();
        }
    };

    restoreRedirectPath = () => {
        const redirectPath = localStorage.getItem(filezPostLoginRedirectPathLocalStorageKey);
        console.log("Restoring redirect path:", redirectPath);
        if (redirectPath) {
            localStorage.removeItem(filezPostLoginRedirectPathLocalStorageKey);
            window.history.replaceState({}, document.title, redirectPath);
        }
    };

    updateFilezClient = async () => {
        // Effect to create or destroy the filezClient based on auth state.
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
            console.log("Filez API client initialized with user token.");

            // Verify the token is active, otherwise force a new sign-in.
            const ownUserRes = await filezClient?.api.getOwnUser().catch(async (response) => {
                if (response?.error?.status?.Error === "IntrospectionGuardError::Inactive") {
                    console.error("User token is inactive, redirecting to sign in.");
                    localStorage.setItem("redirect_uri", window.location.href);
                    await this.props.auth?.signinRedirect();
                }
            });

            if (ownUserRes?.data?.data?.user) {
                this.setState({ ownUser: ownUserRes?.data?.data?.user });
            }
        } else {
            this.setState({
                filezClient: new Api({
                    baseUrl: this.props.clientConfig.serverUrl
                }),
                ownUser: null
            });
        }
    };

    setTheme = async (theme: FilezTheme) => {
        const root = window.document.documentElement;

        root.classList.forEach((cls) => {
            if (cls.startsWith(themePrefix)) {
                root.classList.remove(cls);
            }
        });

        localStorage.setItem(themeLocalStorageKey, theme.id);

        if (theme.id === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                ? `dark`
                : `light`;

            root.classList.add(themePrefix + systemTheme);
            return;
        }

        // IMPORTANT: The order matters here.
        root.classList.add(themePrefix + theme.id);
        if (theme.url) await loadThemeCSS(theme.url);
        // set to local storage
        this.setState({ currentTheme: theme });
    };

    render = () => {
        const { children, auth, clientConfig } = this.props;
        const { filezClient, currentTheme } = this.state;

        const contextValue: FilezContextType = {
            auth: auth!,
            filezClient: filezClient!,
            clientConfig,
            clientLoading: auth?.isLoading || !clientConfig,
            setTheme: this.setTheme,
            currentTheme,
            ownFilezUser: this.state.ownUser
        };

        return <FilezContext.Provider value={contextValue}>{children}</FilezContext.Provider>;
    };
}

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
        this.state = {
            clientConfig: null
        };
    }

    componentDidMount = () => {
        getClientConfig()
            .then((config) => {
                this.setState({ clientConfig: config });
            })
            .catch((error) => {
                console.error("Failed to fetch OIDC config", error);
            });
    };

    onSigninCallback = (_user: User | void): void => {
        const redirectUri = localStorage.getItem("filez_redirect_uri");
        localStorage.removeItem("filez_redirect_uri");
        window.history.replaceState({}, document.title, redirectUri || window.location.pathname);
    };

    render = () => {
        const { clientConfig } = this.state;
        const { children } = this.props;

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
            <I18nextProvider i18n={i18n} defaultNS={"default"}>
                <AuthProvider {...oidcConfig}>
                    <DndProvider backend={HTML5Backend}>
                        <FilezClientManager clientConfig={clientConfig}>
                            {children}
                        </FilezClientManager>
                    </DndProvider>
                </AuthProvider>
            </I18nextProvider>
        );
    };
}
