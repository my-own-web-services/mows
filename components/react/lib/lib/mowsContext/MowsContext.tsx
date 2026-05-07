import { User, WebStorageStateStore } from "oidc-client-ts";
import React, { Component, createContext, type ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { type AuthContextProps, AuthProvider, withAuth } from "react-oidc-context";
import { getBrowserLanguage, type Language, type Translation } from "../languages";
import baseEnglishTranslation from "../languages/en-US/default";
import { log } from "../logging";
import { defaultThemes, loadThemeCSS, type MowsTheme } from "../themes";
import { ActionManager } from "./ActionManager";
import {
    coreDefaultHotkeys,
    defineCoreActions,
    signinRedirectSavePath
} from "./coreActions";
import { type HotkeyConfig, HotkeyManager } from "./HotkeyManager";

export interface MowsOidcConfig {
    readonly issuerUrl: string;
    readonly clientId: string;
    readonly scope?: string;
    readonly redirectPath?: string;
    readonly postLogoutRedirectUri?: string;
}

export interface MowsContextType {
    readonly auth: AuthContextProps;
    readonly mowsUser?: User | null;
    readonly storagePrefix: string;
    readonly setTheme: (theme: MowsTheme) => Promise<void>;
    readonly currentTheme: MowsTheme;
    readonly setLanguage: (language?: Language) => void;
    readonly t: Translation;
    readonly currentLanguage?: Language;
    readonly themes: MowsTheme[];
    readonly languages: Language[];
    readonly actionManager: ActionManager;
    readonly hotkeyManager: HotkeyManager;
    readonly currentlyOpenModal?: string;
    readonly changeActiveModal: (modalType?: string) => void;
}

interface MowsClientManagerProps {
    readonly children: ReactNode;
    readonly storagePrefix: string;
    readonly themes: MowsTheme[];
    readonly languages: Language[];
    readonly initialTranslation: Translation;
    readonly extraActions: import("./ActionManager").Action[];
    readonly extraDefaultHotkeys: HotkeyConfig;
    readonly defaultThemeId: string;
    readonly auth?: AuthContextProps;
}

interface MowsClientManagerState {
    readonly currentTheme: MowsTheme;
    readonly currentTranslation: Translation;
    readonly currentLanguage?: Language;
    readonly currentlyOpenModal?: string;
}

const buildStorageKeys = (prefix: string) => ({
    theme: `${prefix}_theme`,
    selectedLanguage: `${prefix}_language`,
    hotkeyConfig: `${prefix}_hotkey_config`,
    recentActions: `${prefix}_recent_actions`,
    postLoginRedirectPath: `${prefix}_post_login_redirect_path`
});

export class MowsClientManagerBase extends Component<
    MowsClientManagerProps,
    MowsClientManagerState
> {
    private actionManager: ActionManager;
    private hotkeyManager: HotkeyManager;
    private storageKeys: ReturnType<typeof buildStorageKeys>;
    private cssThemePrefix: string;

    constructor(props: MowsClientManagerProps) {
        super(props);
        this.storageKeys = buildStorageKeys(props.storagePrefix);
        this.cssThemePrefix = `${props.storagePrefix}-theme-`;

        const currentThemeId =
            localStorage.getItem(this.storageKeys.theme) || props.defaultThemeId;
        log.info(`Current theme ID:`, currentThemeId);

        this.state = {
            currentTheme:
                props.themes.find((t) => t.id === currentThemeId) || props.themes[0],
            currentTranslation: props.initialTranslation,
            currentLanguage: getBrowserLanguage(props.languages, this.storageKeys.selectedLanguage)
        };

        this.actionManager = new ActionManager({
            recentActionsStorageKey: this.storageKeys.recentActions,
            maxRecentActions: 5
        });
        this.hotkeyManager = new HotkeyManager(this.actionManager, {
            configStorageKey: this.storageKeys.hotkeyConfig,
            defaultHotkeys: { ...coreDefaultHotkeys, ...props.extraDefaultHotkeys }
        });
    }

    componentDidMount = () => {
        const coreActions = defineCoreActions(this, this.storageKeys.postLoginRedirectPath);
        this.actionManager.defineMultipleActions([...coreActions, ...this.props.extraActions]);

        this.setTheme(this.state.currentTheme);
        this.setLanguage(this.state.currentLanguage);
    };

    componentDidUpdate = (prevProps: MowsClientManagerProps) => {
        const { auth } = this.props;
        const prevAuth = prevProps.auth;

        if (auth?.user !== prevAuth?.user) {
            this.restoreRedirectPath();
        }
    };

    changeActiveModal = (modalType?: string) => {
        log.debug(`Changing active modal to:`, modalType);
        this.setState({ currentlyOpenModal: modalType });
    };

    restoreRedirectPath = () => {
        const redirectPath = localStorage.getItem(this.storageKeys.postLoginRedirectPath);
        log.info(`Restoring redirect path:`, redirectPath);
        if (redirectPath) {
            localStorage.removeItem(this.storageKeys.postLoginRedirectPath);
            window.history.replaceState({}, document.title, redirectPath);
        }
    };

    setTheme = async (theme: MowsTheme) => {
        const root = window.document.documentElement;

        root.classList.forEach((cls) => {
            if (cls.startsWith(this.cssThemePrefix)) {
                root.classList.remove(cls);
            }
        });

        localStorage.setItem(this.storageKeys.theme, theme.id);

        if (theme.id === `system`) {
            const systemTheme = window.matchMedia(`(prefers-color-scheme: dark)`).matches
                ? `dark`
                : `light`;

            root.classList.add(this.cssThemePrefix + systemTheme);
            this.setState({ currentTheme: theme });

            return;
        }

        root.classList.add(this.cssThemePrefix + theme.id);
        if (theme.url) await loadThemeCSS(theme.url);
        this.setState({ currentTheme: theme });
    };

    setLanguage = async (languageToSet?: Language) => {
        if (!languageToSet) {
            log.error(`No language provided`);
            return;
        }
        this.setState({ currentLanguage: languageToSet });

        const translation = await languageToSet.import();

        localStorage.setItem(this.storageKeys.selectedLanguage, languageToSet.code);

        this.setState({ currentTranslation: translation.default });
    };

    render = () => {
        const { children, auth, storagePrefix, themes, languages } = this.props;
        const { currentTheme } = this.state;

        const contextValue: MowsContextType = {
            auth: auth!,
            mowsUser: auth?.user,
            storagePrefix,
            setTheme: this.setTheme,
            currentTheme,
            t: this.state.currentTranslation,
            setLanguage: this.setLanguage,
            currentLanguage: this.state.currentLanguage,
            themes,
            languages,
            actionManager: this.actionManager,
            hotkeyManager: this.hotkeyManager,
            currentlyOpenModal: this.state.currentlyOpenModal,
            changeActiveModal: this.changeActiveModal
        };

        return <MowsContext.Provider value={contextValue}>{children}</MowsContext.Provider>;
    };
}

export const MowsContext = createContext<MowsContextType | undefined>(undefined);

export const withMows = <P extends { mows: MowsContextType }>(
    WrappedComponent: React.ComponentType<P>
): React.ComponentType<Omit<P, `mows`>> => {
    return class extends Component<Omit<P, `mows`>> {
        static contextType = MowsContext;
        declare context: React.ContextType<typeof MowsContext>;

        render = () => {
            if (this.context === undefined) {
                throw new Error(`withMows must be used within a MowsProvider`);
            }
            const props = { ...this.props, mows: this.context } as unknown as P;
            return <WrappedComponent {...props} />;
        };
    };
};

export const useMows = (): MowsContextType => {
    const context = React.useContext(MowsContext);
    if (context === undefined) {
        throw new Error(`useMows must be used within a MowsProvider`);
    }
    return context;
};

const MowsClientManager = withAuth(MowsClientManagerBase);

export const baseLanguages: Language[] = [
    {
        code: `en-US`,
        originalName: `English (US)`,
        englishName: `English (US)`,
        emoji: `🇺🇸`,
        import: () => import(`../languages/en-US/default`).then((m) => ({ default: m.default as Translation }))
    },
    {
        code: `de`,
        originalName: `Deutsch`,
        englishName: `German`,
        emoji: `🇩🇪`,
        import: () => import(`../languages/de/default`).then((m) => ({ default: m.default as Translation }))
    }
];

interface MowsProviderProps {
    readonly children: ReactNode;
    readonly storagePrefix: string;
    readonly oidc: MowsOidcConfig;
    readonly themes?: MowsTheme[];
    readonly languages?: Language[];
    readonly initialTranslation?: Translation;
    readonly defaultThemeId?: string;
    readonly extraActions?: import("./ActionManager").Action[];
    readonly extraDefaultHotkeys?: HotkeyConfig;
    readonly onSigninCallback?: (user: User | void) => void;
}

export class MowsProvider extends Component<MowsProviderProps> {
    onSigninCallback = (user: User | void): void => {
        if (this.props.onSigninCallback) {
            this.props.onSigninCallback(user);
            return;
        }
        const storageKey = `${this.props.storagePrefix}_post_login_redirect_path`;
        const redirectUri = localStorage.getItem(storageKey);
        if (redirectUri) {
            localStorage.removeItem(storageKey);
            window.history.replaceState({}, document.title, redirectUri);
        }
    };

    render = () => {
        const {
            children,
            storagePrefix,
            oidc,
            themes = defaultThemes,
            languages = baseLanguages,
            initialTranslation = baseEnglishTranslation as Translation,
            defaultThemeId = `system`,
            extraActions = [],
            extraDefaultHotkeys = {}
        } = this.props;

        const oidcConfig = {
            userStore: new WebStorageStateStore({ store: window.localStorage }),
            authority: oidc.issuerUrl,
            client_id: oidc.clientId,
            redirect_uri: window.location.origin + (oidc.redirectPath ?? `/auth/callback`),
            response_type: `code`,
            scope: oidc.scope ?? `openid profile email`,
            post_logout_redirect_uri: oidc.postLogoutRedirectUri ?? window.location.origin,
            response_mode: `query` as const,
            automaticSilentRenew: true,
            onSigninCallback: this.onSigninCallback
        };

        return (
            <AuthProvider {...oidcConfig}>
                <DndProvider backend={HTML5Backend}>
                    <MowsClientManager
                        storagePrefix={storagePrefix}
                        themes={themes}
                        languages={languages}
                        initialTranslation={initialTranslation}
                        defaultThemeId={defaultThemeId}
                        extraActions={extraActions}
                        extraDefaultHotkeys={extraDefaultHotkeys}
                    >
                        {children}
                    </MowsClientManager>
                </DndProvider>
            </AuthProvider>
        );
    };
}
