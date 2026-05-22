import { User, WebStorageStateStore } from "oidc-client-ts";
import React, { Component, createContext, type ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { type AuthContextProps, AuthProvider, withAuth } from "react-oidc-context";
import { defaultCodeThemes, type MowsCodeTheme } from "../codeThemes";
import { getBrowserLanguage, type Language, type Translation } from "../languages";
import baseEnglishTranslation from "../languages/en-US/default";
import { log } from "../logging";
import { defaultMapStyles, type MowsMapStyle } from "../mapStyles";
import { defaultThemes, loadThemeCSS, type MowsTheme } from "../themes";
import { type Action, ActionManager } from "./ActionManager";
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
    readonly bracketPairColorization: boolean;
}

export const defaultCodeEditorSettings: MowsCodeEditorSettings = {
    showWhitespace: true,
    wrap: true,
    showLineNumbers: true,
    bracketPairColorization: true
};

export type ToastPosition =
    | `top-left`
    | `top-center`
    | `top-right`
    | `bottom-left`
    | `bottom-center`
    | `bottom-right`;

export const TOAST_POSITIONS: readonly ToastPosition[] = [
    `top-left`,
    `top-center`,
    `top-right`,
    `bottom-left`,
    `bottom-center`,
    `bottom-right`
] as const;

export interface MowsToastSettings {
    readonly position: ToastPosition;
}

export const defaultToastSettings: MowsToastSettings = {
    position: `bottom-right`
};

export interface MowsContextType {
    readonly auth: AuthContextProps;
    /** True if a `MowsOidcConfig` was passed to `MowsProvider`. UIs (e.g. the
     * PrimaryMenu login entry) must hide auth-only affordances when this is
     * false — `auth` is still a stub object in that case but calling
     * `signinRedirect` / `signoutRedirect` on it would be a no-op or worse. */
    readonly authConfigured: boolean;
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
    readonly toastSettings: MowsToastSettings;
    readonly setToastSettings: (settings: Partial<MowsToastSettings>) => void;
    readonly mapStyles: MowsMapStyle[];
    readonly currentMapStyle: MowsMapStyle;
    readonly setMapStyle: (style: MowsMapStyle) => void;
}

interface MowsClientManagerProps {
    readonly children: ReactNode;
    readonly storagePrefix: string;
    readonly themes: MowsTheme[];
    readonly languages: Language[];
    readonly initialTranslation: Translation;
    readonly extraActions: Action[];
    readonly extraDefaultHotkeys: HotkeyConfig;
    readonly defaultThemeId: string;
    readonly codeThemes: MowsCodeTheme[];
    readonly defaultCodeThemeId: string;
    readonly mapStyles: MowsMapStyle[];
    readonly defaultMapStyleId: string;
    readonly auth?: AuthContextProps;
    readonly authConfigured: boolean;
}

interface MowsClientManagerState {
    readonly currentTheme: MowsTheme;
    readonly currentTranslation: Translation;
    readonly currentLanguage?: Language;
    readonly currentlyOpenModal?: string;
    readonly currentCodeTheme: MowsCodeTheme;
    readonly codeEditorSettings: MowsCodeEditorSettings;
    readonly toastSettings: MowsToastSettings;
    readonly currentMapStyle: MowsMapStyle;
}

const buildStorageKeys = (prefix: string) => ({
    theme: `${prefix}_theme`,
    codeTheme: `${prefix}_code_theme`,
    codeEditorSettings: `${prefix}_code_editor_settings`,
    toastSettings: `${prefix}_toast_settings`,
    mapStyle: `${prefix}_map_style`,
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

const readToastSettings = (storageKey: string): MowsToastSettings => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultToastSettings;
    try {
        const parsed = JSON.parse(raw);
        const next = { ...defaultToastSettings, ...parsed };
        if (!TOAST_POSITIONS.includes(next.position)) {
            return defaultToastSettings;
        }
        return next;
    } catch (error) {
        log.warn(`Failed to parse stored toast settings; reverting to defaults`, error);
        return defaultToastSettings;
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
            props.themes.find((theme) => theme.id === currentThemeId) || props.themes[0];

        // Apply the theme class synchronously before React paints, so we don't
        // flash the default :root tokens (white surfaces on dark themes, etc.)
        // before componentDidMount fires.
        applyThemeClassSynchronously(initialTheme);

        const currentCodeThemeId =
            localStorage.getItem(this.storageKeys.codeTheme) || props.defaultCodeThemeId;
        const initialCodeTheme =
            props.codeThemes.find((codeTheme) => codeTheme.id === currentCodeThemeId) || props.codeThemes[0];

        const currentMapStyleId =
            localStorage.getItem(this.storageKeys.mapStyle) || props.defaultMapStyleId;
        const initialMapStyle =
            props.mapStyles.find((style) => style.id === currentMapStyleId) || props.mapStyles[0];

        this.state = {
            currentTheme: initialTheme,
            currentTranslation: props.initialTranslation,
            currentLanguage: getBrowserLanguage(props.languages, this.storageKeys.selectedLanguage),
            currentCodeTheme: initialCodeTheme,
            codeEditorSettings: readCodeEditorSettings(this.storageKeys.codeEditorSettings),
            toastSettings: readToastSettings(this.storageKeys.toastSettings),
            currentMapStyle: initialMapStyle
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

    setMapStyle = (style: MowsMapStyle) => {
        localStorage.setItem(this.storageKeys.mapStyle, style.id);
        this.setState({ currentMapStyle: style });
    };

    setCodeEditorSettings = (partial: Partial<MowsCodeEditorSettings>) => {
        const next = { ...this.state.codeEditorSettings, ...partial };
        localStorage.setItem(this.storageKeys.codeEditorSettings, JSON.stringify(next));
        this.setState({ codeEditorSettings: next });
    };

    setToastSettings = (partial: Partial<MowsToastSettings>) => {
        const next = { ...this.state.toastSettings, ...partial };
        if (!TOAST_POSITIONS.includes(next.position)) {
            log.warn(`Ignoring invalid toast position`, partial);
            return;
        }
        localStorage.setItem(this.storageKeys.toastSettings, JSON.stringify(next));
        this.setState({ toastSettings: next });
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
        const {
            children,
            auth,
            authConfigured,
            storagePrefix,
            themes,
            languages,
            codeThemes,
            mapStyles
        } = this.props;
        const {
            currentTheme,
            currentCodeTheme,
            codeEditorSettings,
            toastSettings,
            currentMapStyle
        } = this.state;

        const contextValue: MowsContextType = {
            auth: auth!,
            authConfigured,
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
            setCodeEditorSettings: this.setCodeEditorSettings,
            toastSettings,
            setToastSettings: this.setToastSettings,
            mapStyles,
            currentMapStyle,
            setMapStyle: this.setMapStyle
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
    /** OIDC config. Omit to mount without auth — the PrimaryMenu and other
     * components will hide login affordances. Useful for apps that sit behind
     * a separate auth proxy or use a bearer-token-only API. */
    readonly oidc?: MowsOidcConfig;
    readonly themes?: MowsTheme[];
    readonly languages?: Language[];
    readonly initialTranslation?: Translation;
    readonly defaultThemeId?: string;
    readonly codeThemes?: MowsCodeTheme[];
    readonly defaultCodeThemeId?: string;
    readonly mapStyles?: MowsMapStyle[];
    readonly defaultMapStyleId?: string;
    readonly extraActions?: Action[];
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
            defaultCodeThemeId = `one-dark-nx`,
            mapStyles = defaultMapStyles,
            defaultMapStyleId = `maplibre-demo`,
            extraActions = [],
            extraDefaultHotkeys = {}
        } = this.props;

        const managerCommonProps = {
            storagePrefix,
            themes,
            languages,
            initialTranslation,
            defaultThemeId,
            codeThemes,
            defaultCodeThemeId,
            mapStyles,
            defaultMapStyleId,
            extraActions,
            extraDefaultHotkeys,
            authConfigured: !!oidc
        } as const;

        if (!oidc) {
            // No OIDC config — mount without `<AuthProvider>` and without the
            // `withAuth` HOC (which would emit a console warning when no
            // AuthContext is present). PrimaryMenu and friends consult
            // `authConfigured` from the context to hide login affordances.
            return (
                <DndProvider backend={HTML5Backend}>
                    <MowsClientManagerBase {...managerCommonProps}>
                        {children}
                    </MowsClientManagerBase>
                </DndProvider>
            );
        }

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
                    <MowsClientManager {...managerCommonProps}>{children}</MowsClientManager>
                </DndProvider>
            </AuthProvider>
        );
    };
}
