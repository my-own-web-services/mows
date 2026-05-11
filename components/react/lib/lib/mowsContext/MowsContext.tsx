import { User, WebStorageStateStore } from "oidc-client-ts";
import React, { Component, createContext, type ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { type AuthContextProps, AuthProvider, withAuth } from "react-oidc-context";
import { defaultCodeThemes, type MowsCodeTheme } from "../codeThemes";
import { getBrowserLanguage, type Language, type Translation } from "../languages";
import baseEnglishTranslation from "../languages/en-US/default";
import { log } from "../logging";
import { defaultThemes, loadThemeCSS, type MowsTheme } from "../themes";
import { ActionManager } from "./ActionManager";
import { coreDefaultHotkeys, defineCoreActions } from "./coreActions";
import { type HotkeyConfig, HotkeyManager } from "./HotkeyManager";

export interface MowsOidcConfig {
    readonly issuerUrl: string;
    readonly clientId: string;
    readonly scope?: string;
    readonly redirectPath?: string;
    readonly postLogoutRedirectUri?: string;
}

export interface MowsCodeEditorSettings {
    readonly showWhitespace: boolean;
    readonly wrap: boolean;
    readonly showLineNumbers: boolean;
}

export const defaultCodeEditorSettings: MowsCodeEditorSettings = {
    showWhitespace: true,
    wrap: true,
    showLineNumbers: true
};

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
    readonly codeThemes: MowsCodeTheme[];
    readonly currentCodeTheme: MowsCodeTheme;
    readonly setCodeTheme: (theme: MowsCodeTheme) => void;
    readonly codeEditorSettings: MowsCodeEditorSettings;
    readonly setCodeEditorSettings: (settings: Partial<MowsCodeEditorSettings>) => void;
}

interface MowsClientManagerProps {
    readonly children: ReactNode;
    readonly storagePrefix: string;
    readonly themes: MowsTheme[];
    readonly languages: Language[];
    readonly initialTranslation: Translation;
    // eslint-disable-next-line quotes
    readonly extraActions: import("./ActionManager").Action[];
    readonly extraDefaultHotkeys: HotkeyConfig;
    readonly defaultThemeId: string;
    readonly codeThemes: MowsCodeTheme[];
    readonly defaultCodeThemeId: string;
    readonly auth?: AuthContextProps;
}

interface MowsClientManagerState {
    readonly currentTheme: MowsTheme;
    readonly currentTranslation: Translation;
    readonly currentLanguage?: Language;
    readonly currentlyOpenModal?: string;
    readonly currentCodeTheme: MowsCodeTheme;
    readonly codeEditorSettings: MowsCodeEditorSettings;
}

const buildStorageKeys = (prefix: string) => ({
    theme: `${prefix}_theme`,
    codeTheme: `${prefix}_code_theme`,
    codeEditorSettings: `${prefix}_code_editor_settings`,
    selectedLanguage: `${prefix}_language`,
    hotkeyConfig: `${prefix}_hotkey_config`,
    recentActions: `${prefix}_recent_actions`,
    postLoginRedirectPath: `${prefix}_post_login_redirect_path`
});

const readCodeEditorSettings = (storageKey: string): MowsCodeEditorSettings => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultCodeEditorSettings;
    try {
        const parsed = JSON.parse(raw);
        return { ...defaultCodeEditorSettings, ...parsed };
    } catch (error) {
        log.warn(`Failed to parse stored code editor settings; reverting to defaults`, error);
        return defaultCodeEditorSettings;
    }
};

const applyThemeClassSynchronously = (theme: MowsTheme) => {
    if (typeof document === `undefined`) return;
    const root = document.documentElement;

    root.classList.forEach((cls) => {
        if (cls.startsWith(`theme-`)) root.classList.remove(cls);
    });

    if (theme.id === `system`) {
        const systemTheme = window.matchMedia(`(prefers-color-scheme: dark)`).matches
            ? `dark`
            : `light`;
        root.classList.add(`theme-${systemTheme}`);
        return;
    }

    root.classList.add(`theme-${theme.id}`);
};

export class MowsClientManagerBase extends Component<
    MowsClientManagerProps,
    MowsClientManagerState
> {
    private actionManager: ActionManager;
    private hotkeyManager: HotkeyManager;
    private storageKeys: ReturnType<typeof buildStorageKeys>;

    constructor(props: MowsClientManagerProps) {
        super(props);
        this.storageKeys = buildStorageKeys(props.storagePrefix);

        const currentThemeId =
            localStorage.getItem(this.storageKeys.theme) || props.defaultThemeId;
        log.info(`Current theme ID:`, currentThemeId);

        const initialTheme =
            props.themes.find((t) => t.id === currentThemeId) || props.themes[0];

        // Apply the theme class synchronously before React paints, so we don't
        // flash the default :root tokens (white surfaces on dark themes, etc.)
        // before componentDidMount fires.
        applyThemeClassSynchronously(initialTheme);

        const currentCodeThemeId =
            localStorage.getItem(this.storageKeys.codeTheme) || props.defaultCodeThemeId;
        const initialCodeTheme =
            props.codeThemes.find((t) => t.id === currentCodeThemeId) || props.codeThemes[0];

        this.state = {
            currentTheme: initialTheme,
            currentTranslation: props.initialTranslation,
            currentLanguage: getBrowserLanguage(props.languages, this.storageKeys.selectedLanguage),
            currentCodeTheme: initialCodeTheme,
            codeEditorSettings: readCodeEditorSettings(this.storageKeys.codeEditorSettings)
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
            if (cls.startsWith(`theme-`)) {
                root.classList.remove(cls);
            }
        });

        localStorage.setItem(this.storageKeys.theme, theme.id);

        if (theme.id === `system`) {
            const systemTheme = window.matchMedia(`(prefers-color-scheme: dark)`).matches
                ? `dark`
                : `light`;

            root.classList.add(`theme-${systemTheme}`);
            this.setState({ currentTheme: theme });

            return;
        }

        root.classList.add(`theme-${theme.id}`);
        if (theme.url) await loadThemeCSS(theme.url);
        this.setState({ currentTheme: theme });
    };

    setCodeTheme = (theme: MowsCodeTheme) => {
        localStorage.setItem(this.storageKeys.codeTheme, theme.id);
        this.setState({ currentCodeTheme: theme });
    };

    setCodeEditorSettings = (partial: Partial<MowsCodeEditorSettings>) => {
        const next = { ...this.state.codeEditorSettings, ...partial };
        localStorage.setItem(this.storageKeys.codeEditorSettings, JSON.stringify(next));
        this.setState({ codeEditorSettings: next });
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
        const { children, auth, storagePrefix, themes, languages, codeThemes } = this.props;
        const { currentTheme, currentCodeTheme, codeEditorSettings } = this.state;

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
            changeActiveModal: this.changeActiveModal,
            codeThemes,
            currentCodeTheme,
            setCodeTheme: this.setCodeTheme,
            codeEditorSettings,
            setCodeEditorSettings: this.setCodeEditorSettings
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
    readonly codeThemes?: MowsCodeTheme[];
    readonly defaultCodeThemeId?: string;
    // eslint-disable-next-line quotes
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
            codeThemes = defaultCodeThemes,
            defaultCodeThemeId = `vs-dark`,
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
                        codeThemes={codeThemes}
                        defaultCodeThemeId={defaultCodeThemeId}
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
