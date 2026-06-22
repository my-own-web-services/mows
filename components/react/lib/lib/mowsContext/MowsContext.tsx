// Auth (oidc-client-ts / react-oidc-context) and drag-and-drop (react-dnd) are
// only loaded on demand — see the `OidcAuthGate` / `DndGate` lazy chunks below.
// Apps that use neither (e.g. a magic-link app via `authAdapter`, no DnD) never
// pull these into their bundle. Only the *types* are imported statically (erased
// at build, zero runtime cost).
import type { User } from "oidc-client-ts";
import React, { Component, createContext, lazy, Suspense, type ReactNode } from "react";
import type { AuthContextProps } from "react-oidc-context";
import { defaultCodeThemes, type MowsCodeTheme } from "../codeThemes";
import { type Language, type Translation } from "../languages";
import baseEnglishTranslation from "../languages/en-US/default";
import { log } from "../logging";
import { defaultMapStyles, type MowsMapStyle } from "../mapStyles";
import { defaultThemes, loadThemeCSS, type MowsTheme } from "../themes";
import {
    type Action,
    type ActionManagerToastStrings,
    ActionManager
} from "./ActionManager";
import { UndoStackManager } from "./UndoStackManager";
import {
    type AnyAppSettings,
    type AppSettingsContextValue,
    createAppSettingsContextValue
} from "./appSettings";
import { coreDefaultHotkeys, defineCoreActions } from "./coreActions";
import { type HotkeyConfig, HotkeyManager } from "./HotkeyManager";
import { migrateLegacySettings } from "./legacyMigration";
import { SettingsManager } from "./SettingsManager";

export interface MowsOidcConfig {
    readonly issuerUrl: string;
    readonly clientId: string;
    readonly scope?: string;
    readonly redirectPath?: string;
    readonly postLogoutRedirectUri?: string;
}

/**
 * Custom (non-OIDC) authentication for apps that bring their own auth flow
 * (e.g. magic-link cookie sessions). Pass it as `authAdapter` to
 * `<MowsProvider>` instead of `oidc`. The provider maps it onto the same
 * `auth` surface that OIDC consumers (PrimaryMenu, core sign-in/out actions)
 * already use — `authConfigured` becomes true and `auth.isAuthenticated`,
 * `auth.signinRedirect` (→ `signIn`), `auth.signoutRedirect` (→ `signOut`) and
 * `auth.user` (→ `mowsUser`) are served from the adapter. The OIDC path is
 * untouched; `oidc` takes precedence if both are given.
 *
 * The adapter is a plain (ideally memoized) value held by the consuming app;
 * re-render `<MowsProvider>` with a fresh adapter whenever auth state changes
 * so dependent UI updates.
 */
export interface MowsAuthAdapter {
    /** Whether a session is currently established. */
    readonly isAuthenticated: boolean;
    /** Start the app's sign-in flow (e.g. show the magic-link form). */
    readonly signIn: () => void | Promise<void>;
    /** End the session (e.g. clear the cookie and reload). */
    readonly signOut: () => void | Promise<void>;
    /**
     * Optional identity surfaced as `mowsUser`. App-specific; the PrimaryMenu's
     * own `user` prop drives the displayed name, so this may be omitted.
     */
    readonly user?: User | null;
}

/**
 * Map a {@link MowsAuthAdapter} onto the `AuthContextProps` shape consumed
 * internally. Only the four members read by MOWS components on the custom-auth
 * path are populated (see PrimaryMenu + coreActions); the remaining members are
 * OIDC-only and never invoked here.
 */
function adapterToAuthContext(adapter: MowsAuthAdapter): AuthContextProps {
    return {
        isLoading: false,
        isAuthenticated: adapter.isAuthenticated,
        user: adapter.user ?? null,
        signinRedirect: async () => {
            await adapter.signIn();
        },
        signoutRedirect: async () => {
            await adapter.signOut();
        }
    } as unknown as AuthContextProps;
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

/**
 * Globally configurable temperature display unit. Mirrors
 * `WeatherExpandableTemperatureUnit` — declared here so MowsContext
 * stays decoupled from `components/map/*` while still publishing a
 * typed surface to consumers.
 */
export type MowsTemperatureUnit = `celsius` | `fahrenheit` | `kelvin`;

export const MOWS_TEMPERATURE_UNITS: readonly MowsTemperatureUnit[] = [
    `celsius`,
    `fahrenheit`,
    `kelvin`
] as const;

export const DEFAULT_TEMPERATURE_UNIT: MowsTemperatureUnit = `celsius`;

const readTemperatureUnitFromBlob = (
    raw: string | undefined
): MowsTemperatureUnit =>
    (MOWS_TEMPERATURE_UNITS as readonly string[]).includes(raw ?? ``)
        ? (raw as MowsTemperatureUnit)
        : DEFAULT_TEMPERATURE_UNIT;

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
    /** Globally selected temperature display unit. Read by components
     * that render temperatures (e.g. `<WeatherExpandable>`); flip via
     * `setTemperatureUnit` (also surfaced as a row in `SettingsPanel`).
     * The string union mirrors `WeatherExpandableTemperatureUnit`; we
     * declare it locally to keep MowsContext free of a downstream
     * import. */
    readonly currentTemperatureUnit: MowsTemperatureUnit;
    readonly setTemperatureUnit: (unit: MowsTemperatureUnit) => void;
    /** Unified settings system (single localStorage blob). Exposed so
     * advanced consumers can read/replace the entire blob (JSON
     * export/import tab in SettingsPanel) and so app-settings hooks
     * have a backdoor to the manager when they need it. Day-to-day
     * settings reads should go through the dedicated `current*` /
     * `set*` accessors above. */
    readonly settingsManager: SettingsManager;
    /** App-settings registry handles, populated when MowsProvider was
     * mounted with an `appSettings` prop. `registered` is null when no
     * app schema was registered. */
    readonly appSettings: AppSettingsContextValue;
}

export interface MowsClientManagerProps {
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
    readonly appSettings: AnyAppSettings | null;
    readonly globalHotkeys: boolean;
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
    readonly currentTemperatureUnit: MowsTemperatureUnit;
    /** Held in state (not as an instance field) so a prop-driven
     * recompute schedules a normal render via setState instead of
     * `forceUpdate`. The reference identity changes only when
     * `props.appSettings` or `this.settingsManager` change. */
    readonly appSettingsContext: AppSettingsContextValue;
}

/** Auth helper key suffix — intentionally NOT inside the unified
 * settings blob. The value is transient (lives at most one OIDC
 * round-trip) and is cleared on resume; mixing it into the blob would
 * tempt callers to surface it in the settings UI. */
const POST_LOGIN_REDIRECT_PATH_SUFFIX = `_post_login_redirect_path`;

/**
 * Adapt the `Translation.actionHistory` block to the
 * `ActionManagerToastStrings` shape ActionManager consumes. Kept here so
 * ActionManager stays decoupled from the React `Translation` interface;
 * the wiring direction is `Translation → ActionManager`, never the
 * reverse.
 */
const buildActionManagerToastStrings = (
    translation: Translation | undefined
): ActionManagerToastStrings => ({
    undoFailed:
        translation?.actionHistory?.undoFailed ?? `Could not undo: {error}`,
    undoNoHandler:
        translation?.actionHistory?.undoNoHandler ?? `Cannot undo: action not available`,
    undoDropped:
        translation?.actionHistory?.undoDropped ??
        `Could not undo after {n} attempts; entry removed`,
    auditPersistenceDisabled:
        translation?.actionHistory?.auditPersistenceDisabled ??
        `Action history will not persist for this session due to storage quota`
});

const readCodeEditorFromBlob = (
    raw: Record<string, unknown> | undefined
): MowsCodeEditorSettings => {
    if (!raw) return defaultCodeEditorSettings;
    return {
        showWhitespace:
            typeof raw.showWhitespace === `boolean`
                ? raw.showWhitespace
                : defaultCodeEditorSettings.showWhitespace,
        wrap: typeof raw.wrap === `boolean` ? raw.wrap : defaultCodeEditorSettings.wrap,
        showLineNumbers:
            typeof raw.showLineNumbers === `boolean`
                ? raw.showLineNumbers
                : defaultCodeEditorSettings.showLineNumbers,
        bracketPairColorization:
            typeof raw.bracketPairColorization === `boolean`
                ? raw.bracketPairColorization
                : defaultCodeEditorSettings.bracketPairColorization
    };
};

const readToastFromBlob = (
    raw: Record<string, unknown> | undefined
): MowsToastSettings => {
    if (!raw) return defaultToastSettings;
    const position = raw.position;
    if (
        typeof position === `string` &&
        (TOAST_POSITIONS as readonly string[]).includes(position)
    ) {
        return { position: position as ToastPosition };
    }
    return defaultToastSettings;
};

const pickLanguage = (languages: Language[], code: string | undefined): Language => {
    if (code) {
        const lang = languages.find((l) => l.code === code);
        if (lang) return lang;
    }
    const browserCode = navigator.language || navigator.languages?.[0] || `en-US`;
    return (
        languages.find((l) => l.code === browserCode) ||
        languages.find((l) => l.code === browserCode.split(`-`)[0]) ||
        languages.find((l) => l.code === `en-US`)!
    );
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
    /** Exposed publicly so the built-in undo / redo / history actions in
     * `coreActions.ts` can delegate to the manager without needing to
     * receive it as a separate constructor arg. */
    actionManager: ActionManager;
    private hotkeyManager: HotkeyManager;
    /** Exposed publicly for the same reason as `actionManager` — the
     * REPLACE_SETTINGS_BLOB core action needs to read + write the blob. */
    settingsManager: SettingsManager;
    private undoStackManager: UndoStackManager;
    private postLoginRedirectKey: string;
    private unsubscribeSettings: (() => void) | null = null;
    /** Tracks the most-recently-requested language code so an older
     * `import()` resolving late doesn't overwrite the newer choice
     * (rapid double-click on the language picker). */
    private pendingLanguageCode: string | null = null;

    constructor(props: MowsClientManagerProps) {
        super(props);
        this.postLoginRedirectKey = `${props.storagePrefix}${POST_LOGIN_REDIRECT_PATH_SUFFIX}`;

        // Run the legacy-key migration BEFORE constructing SettingsManager
        // — if the old keys exist and the new key doesn't, we pre-seed
        // the manager so its first persistence pass writes the unified
        // blob in the same tick (no half-migrated state on disk).
        const migration =
            typeof localStorage !== `undefined`
                ? migrateLegacySettings(props.storagePrefix, localStorage)
                : { migrated: false };
        this.settingsManager = new SettingsManager({
            storagePrefix: props.storagePrefix,
            initialBlob: migration.blob
        });

        const initialTheme = pickThemeFromBlob(
            this.settingsManager,
            props.themes,
            props.defaultThemeId
        );

        // Apply the theme class synchronously before React paints, so we don't
        // flash the default :root tokens (white surfaces on dark themes, etc.)
        // before componentDidMount fires.
        applyThemeClassSynchronously(initialTheme);

        const initialCodeTheme = pickById(
            props.codeThemes,
            this.settingsManager.getCore(`codeTheme`),
            props.defaultCodeThemeId
        );
        const initialMapStyle = pickById(
            props.mapStyles,
            this.settingsManager.getCore(`mapStyle`),
            props.defaultMapStyleId
        );

        this.undoStackManager = new UndoStackManager({ storagePrefix: props.storagePrefix });
        this.actionManager = new ActionManager({
            recentActionsSlot: this.settingsManager.deviceSlotAdapter(`recentActions`),
            maxRecentActions: 5,
            auditLogSlot: this.settingsManager.deviceSlotAdapter(`auditLog`),
            historyConfigSlot: this.settingsManager.deviceSlotAdapter(`actionHistory`),
            undoStackManager: this.undoStackManager,
            toastStrings: () => buildActionManagerToastStrings(this.state.currentTranslation)
        });
        this.hotkeyManager = new HotkeyManager(this.actionManager, {
            configSlot: this.settingsManager.deviceSlotAdapter(`hotkeyConfig`),
            defaultHotkeys: { ...coreDefaultHotkeys, ...props.extraDefaultHotkeys },
            globalListener: props.globalHotkeys
        });

        this.state = {
            currentTheme: initialTheme,
            currentTranslation: props.initialTranslation,
            currentLanguage: pickLanguage(
                props.languages,
                this.settingsManager.getCore(`language`)
            ),
            currentCodeTheme: initialCodeTheme,
            codeEditorSettings: readCodeEditorFromBlob(
                this.settingsManager.getCore(`codeEditor`)
            ),
            toastSettings: readToastFromBlob(this.settingsManager.getCore(`toast`)),
            currentMapStyle: initialMapStyle,
            currentTemperatureUnit: readTemperatureUnitFromBlob(
                this.settingsManager.getCore(`temperatureUnit`)
            ),
            appSettingsContext: createAppSettingsContextValue(
                this.settingsManager,
                props.appSettings
            )
        };
    }

    componentDidMount = () => {
        const coreActions = defineCoreActions(this, this.postLoginRedirectKey);
        this.actionManager.defineMultipleActions([...coreActions, ...this.props.extraActions]);

        this.setTheme(this.state.currentTheme);
        this.setLanguage(this.state.currentLanguage);

        // Subscribe to wholesale blob replacements (JSON import tab in
        // SettingsPanel) so the in-state derived values (theme,
        // language, …) refresh when a paste happens.
        this.unsubscribeSettings = this.settingsManager.subscribe(`*`, this.syncStateFromBlob);
    };

    componentDidUpdate = (prevProps: MowsClientManagerProps) => {
        const { auth } = this.props;
        const prevAuth = prevProps.auth;

        if (auth?.user !== prevAuth?.user) {
            this.restoreRedirectPath();
        }

        if (this.props.appSettings !== prevProps.appSettings) {
            // Rebind the typed-hook surface to the new schema. React
            // schedules a normal render from setState — no forceUpdate
            // bypass, no batching surprises.
            this.setState({
                appSettingsContext: createAppSettingsContextValue(
                    this.settingsManager,
                    this.props.appSettings
                )
            });
        }
    };

    componentWillUnmount = () => {
        this.unsubscribeSettings?.();
        this.unsubscribeSettings = null;
        this.settingsManager.destroy();
    };

    changeActiveModal = (modalType?: string) => {
        log.debug(`Changing active modal to:`, modalType);
        this.setState({ currentlyOpenModal: modalType });
    };

    restoreRedirectPath = () => {
        const redirectPath = localStorage.getItem(this.postLoginRedirectKey);
        log.info(`Restoring redirect path:`, redirectPath);
        if (redirectPath) {
            localStorage.removeItem(this.postLoginRedirectKey);
            window.history.replaceState({}, document.title, redirectPath);
        }
    };

    /**
     * Re-derive in-state values from the unified blob — invoked when
     * the JSON import tab replaces the whole blob. We don't subscribe
     * per-slice because the JSON tab is the only writer that bypasses
     * `set*` methods; individual `set*` calls already update state in
     * the same tick (avoiding an extra rerender from the subscriber).
     */
    private syncStateFromBlob = () => {
        const codeThemeId = this.settingsManager.getCore(`codeTheme`);
        const mapStyleId = this.settingsManager.getCore(`mapStyle`);
        const languageCode = this.settingsManager.getCore(`language`);

        const nextTheme = pickThemeFromBlob(
            this.settingsManager,
            this.props.themes,
            this.props.defaultThemeId
        );
        const nextCodeTheme = pickById(
            this.props.codeThemes,
            codeThemeId,
            this.props.defaultCodeThemeId
        );
        const nextMapStyle = pickById(
            this.props.mapStyles,
            mapStyleId,
            this.props.defaultMapStyleId
        );

        this.setState({
            currentTheme: nextTheme,
            currentCodeTheme: nextCodeTheme,
            currentMapStyle: nextMapStyle,
            codeEditorSettings: readCodeEditorFromBlob(
                this.settingsManager.getCore(`codeEditor`)
            ),
            toastSettings: readToastFromBlob(this.settingsManager.getCore(`toast`)),
            currentTemperatureUnit: readTemperatureUnitFromBlob(
                this.settingsManager.getCore(`temperatureUnit`)
            )
        });

        // Always re-apply the theme class — the blob may have flipped
        // between "system" and an explicit id without changing the
        // resolved id (e.g. system → light when system was dark), so a
        // shortcut comparison would miss the class-name swap.
        applyThemeClassSynchronously(nextTheme);

        const nextLanguage = pickLanguage(this.props.languages, languageCode);
        if (nextLanguage.code !== this.state.currentLanguage?.code) {
            this.setLanguage(nextLanguage);
        }
    };

    setTheme = async (theme: MowsTheme) => {
        const root = window.document.documentElement;

        root.classList.forEach((cls) => {
            if (cls.startsWith(`theme-`)) {
                root.classList.remove(cls);
            }
        });

        this.settingsManager.setCore(`theme`, theme.id);

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
        this.settingsManager.setCore(`codeTheme`, theme.id);
        this.setState({ currentCodeTheme: theme });
    };

    setMapStyle = (style: MowsMapStyle) => {
        this.settingsManager.setCore(`mapStyle`, style.id);
        this.setState({ currentMapStyle: style });
    };

    setTemperatureUnit = (unit: MowsTemperatureUnit) => {
        if (!(MOWS_TEMPERATURE_UNITS as readonly string[]).includes(unit)) {
            log.warn(`Ignoring invalid temperature unit`, unit);
            return;
        }
        this.settingsManager.setCore(`temperatureUnit`, unit);
        this.setState({ currentTemperatureUnit: unit });
    };

    setCodeEditorSettings = (partial: Partial<MowsCodeEditorSettings>) => {
        const next = { ...this.state.codeEditorSettings, ...partial };
        this.settingsManager.setCore(`codeEditor`, next as Record<string, unknown>);
        this.setState({ codeEditorSettings: next });
    };

    setToastSettings = (partial: Partial<MowsToastSettings>) => {
        const next = { ...this.state.toastSettings, ...partial };
        if (!TOAST_POSITIONS.includes(next.position)) {
            log.warn(`Ignoring invalid toast position`, partial);
            return;
        }
        this.settingsManager.setCore(`toast`, next as Record<string, unknown>);
        this.setState({ toastSettings: next });
    };

    setLanguage = async (languageToSet?: Language) => {
        if (!languageToSet) {
            log.error(`No language provided`);
            return;
        }
        this.pendingLanguageCode = languageToSet.code;
        this.setState({ currentLanguage: languageToSet });

        const translation = await languageToSet.import();

        // If the user picked a different language while our import()
        // was in flight, the newer pick already won — drop this
        // resolution on the floor so we don't apply stale strings.
        if (this.pendingLanguageCode !== languageToSet.code) return;

        this.settingsManager.setCore(`language`, languageToSet.code);
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
            currentMapStyle,
            currentTemperatureUnit
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
            setMapStyle: this.setMapStyle,
            currentTemperatureUnit,
            setTemperatureUnit: this.setTemperatureUnit,
            settingsManager: this.settingsManager,
            appSettings: this.state.appSettingsContext
        };

        return <MowsContext.Provider value={contextValue}>{children}</MowsContext.Provider>;
    };
}

const pickThemeFromBlob = (
    settingsManager: SettingsManager,
    themes: MowsTheme[],
    defaultThemeId: string
): MowsTheme => {
    const stored = settingsManager.getCore(`theme`);
    return (
        themes.find((theme) => theme.id === stored) ||
        themes.find((theme) => theme.id === defaultThemeId) ||
        themes[0]
    );
};

const pickById = <T extends { id: string }>(
    list: T[],
    storedId: string | undefined,
    defaultId: string
): T => {
    return (
        list.find((item) => item.id === storedId) ||
        list.find((item) => item.id === defaultId) ||
        list[0]
    );
};

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

// Lazy chunks: the OIDC auth wiring (react-oidc-context + oidc-client-ts) and
// the drag-and-drop provider (react-dnd). They are only fetched when actually
// rendered — `oidc` configured, resp. `dnd` not disabled — so non-OIDC / non-DnD
// apps never download them.
const OidcAuthGate = lazy(() => import(`./OidcAuthGate`));
const DndGate = lazy(() => import(`./DndGate`));

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
    /** Custom (non-OIDC) authentication adapter — e.g. a magic-link cookie
     * session. Mutually alternative to `oidc` (if both are set, `oidc` wins).
     * Makes `authConfigured` true and feeds the same `auth` surface OIDC uses.
     * See {@link MowsAuthAdapter}. */
    readonly authAdapter?: MowsAuthAdapter;
    /** Attach MOWS' app-wide hotkey listener (command palette, undo/redo).
     * Default true. Set false when embedding MOWS in a focused app that must
     * keep native `mod+z` etc. in its own inputs (e.g. a chat composer). */
    readonly globalHotkeys?: boolean;
    /** Wrap the tree in react-dnd's `DndProvider` (default true; lazily loaded).
     * Set false for apps that use no MOWS drag-and-drop component — then
     * `react-dnd` is never fetched. */
    readonly dnd?: boolean;
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
    /**
     * Optional consumer-app settings schema. Build it via
     * `defineAppSettings({ appKey, schema })`. When set, the schema's
     * fields are persisted into the unified settings blob under
     * `app.<appKey>.*` and become available via `useAppSetting`. The
     * built-in `<SettingsPanel>` auto-renders one section per
     * registered field. See the SettingsSystem guide for the full
     * pattern.
     *
     * IMPORTANT: pass a stable reference (a module-level constant
     * returned by `defineAppSettings`). Swapping the schema at runtime
     * works (the typed-hook surface re-binds) but writes already
     * stored under the OLD `appKey` are not migrated; if the new
     * schema changes `appKey`, those values become orphaned in the
     * blob. Don't mutate the schema either — `defineAppSettings`
     * returns the object verbatim.
     */
    readonly appSettings?: AnyAppSettings;
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
            authAdapter,
            themes = defaultThemes,
            languages = baseLanguages,
            initialTranslation = baseEnglishTranslation as Translation,
            defaultThemeId = `system`,
            codeThemes = defaultCodeThemes,
            defaultCodeThemeId = `one-dark-nx`,
            mapStyles = defaultMapStyles,
            defaultMapStyleId = `openfreemap-liberty`,
            extraActions = [],
            extraDefaultHotkeys = {},
            globalHotkeys = true,
            dnd = true
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
            // OIDC or a custom adapter both count as "auth configured".
            authConfigured: !!oidc || !!authAdapter,
            appSettings: this.props.appSettings ?? null,
            globalHotkeys
        } as const;

        // 1) Auth layer. OIDC → lazy `OidcAuthGate` (pulls react-oidc-context +
        //    oidc-client-ts only here). Custom adapter / none → the manager
        //    directly, no auth deps.
        let tree: ReactNode;
        if (oidc) {
            tree = (
                <Suspense fallback={null}>
                    <OidcAuthGate
                        oidc={oidc}
                        managerProps={managerCommonProps}
                        onSigninCallback={this.onSigninCallback}
                    >
                        {children}
                    </OidcAuthGate>
                </Suspense>
            );
        } else if (authAdapter) {
            tree = (
                <MowsClientManagerBase {...managerCommonProps} auth={adapterToAuthContext(authAdapter)}>
                    {children}
                </MowsClientManagerBase>
            );
        } else {
            // No auth — PrimaryMenu and friends consult `authConfigured` to hide
            // login affordances.
            tree = (
                <MowsClientManagerBase {...managerCommonProps}>{children}</MowsClientManagerBase>
            );
        }

        // 2) Optional drag-and-drop layer (lazy `DndGate`, react-dnd loaded only
        //    here). Independent React context, so the relative order vs. the auth
        //    layer doesn't matter.
        if (!dnd) return tree;
        return (
            <Suspense fallback={null}>
                <DndGate>{tree}</DndGate>
            </Suspense>
        );
    };
}
