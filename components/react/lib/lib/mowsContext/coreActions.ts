import { Action, ActionVisibility } from "./ActionManager";
import { log } from "../logging";
import type { MowsClientManagerBase } from "./MowsContext";
import type { HotkeyConfig } from "./HotkeyManager";
import type { SettingsBlob } from "./SettingsManager";
import type { SigninRedirectArgs } from "oidc-client-ts";

export enum CoreActionIds {
    OPEN_COMMAND_PALETTE = `mows.openCommandPalette`,
    OPEN_KEYBOARD_SHORTCUTS = `mows.openKeyboardShortcuts`,
    OPEN_LANGUAGE_SETTINGS = `mows.openLanguageSettings`,
    OPEN_THEME_SELECTOR = `mows.openThemeSelector`,
    OPEN_CODE_THEME_SELECTOR = `mows.openCodeThemeSelector`,
    OPEN_SETTINGS = `mows.openSettings`,
    OPEN_PRIMARY_MENU = `mows.openPrimaryMenu`,
    LOGIN = `mows.user.login`,
    LOGOUT = `mows.user.logout`,
    OPEN_DEV_TOOLS = `mows.developer.openDevTools`,
    UNDO = `mows.history.undo`,
    REDO = `mows.history.redo`,
    OPEN_HISTORY = `mows.history.open`,
    /** Dispatchable theme change with built-in undo. Payload:
     * `{ themeId: string }`. Inverse: restores the previously-active theme. */
    SET_THEME = `mows.theme.set`,
    /** Wholesale replacement of the unified settings blob (JSON paste in
     * SettingsPanel). Payload: `{ blob: SettingsBlob }`. Inverse: restores
     * the previous blob. One Ctrl+Z reverts the entire paste. */
    REPLACE_SETTINGS_BLOB = `mows.settings.replaceBlob`
}

export const CoreModalTypes = {
    keyboardShortcutEditor: `keyboardShortcutEditor`,
    themeSelector: `themeSelector`,
    languageSelector: `languageSelector`,
    codeThemeSelector: `codeThemeSelector`,
    settings: `settings`,
    devTools: `devTools`,
    history: `history`
} as const;

export const signinRedirectSavePath = async (
    signinRedirectFunction: (args?: SigninRedirectArgs) => Promise<void>,
    storageKey: string
) => {
    const redirect_uri = window.location.pathname + window.location.search;
    localStorage.setItem(storageKey, redirect_uri);
    await signinRedirectFunction();
};

export const defineCoreActions = (
    provider: MowsClientManagerBase,
    postLoginRedirectStorageKey: string
): Action[] => {
    return [
        new Action({
            id: CoreActionIds.OPEN_COMMAND_PALETTE,
            category: `General`,
            doNotTrackUsage: true
        }),
        new Action({
            id: CoreActionIds.OPEN_KEYBOARD_SHORTCUTS,
            category: `General`,
            actionHandlers: new Map([
                [
                    `GlobalOpenKeyboardShortcuts`,
                    {
                        id: `GlobalOpenKeyboardShortcuts`,
                        executeAction: () =>
                            provider.changeActiveModal(CoreModalTypes.keyboardShortcutEditor),
                        getState: () => ({ visibility: ActionVisibility.Shown })
                    }
                ]
            ])
        }),
        new Action({
            id: CoreActionIds.OPEN_LANGUAGE_SETTINGS,
            category: `General`,
            actionHandlers: new Map([
                [
                    `GlobalOpenLanguageSettings`,
                    {
                        id: `GlobalOpenLanguageSettings`,
                        executeAction: () =>
                            provider.changeActiveModal(CoreModalTypes.languageSelector),
                        getState: () => ({ visibility: ActionVisibility.Shown })
                    }
                ]
            ])
        }),
        new Action({
            id: CoreActionIds.OPEN_THEME_SELECTOR,
            category: `General`,
            actionHandlers: new Map([
                [
                    `GlobalOpenThemeSelector`,
                    {
                        id: `GlobalOpenThemeSelector`,
                        executeAction: () =>
                            provider.changeActiveModal(CoreModalTypes.themeSelector),
                        getState: () => ({ visibility: ActionVisibility.Shown })
                    }
                ]
            ])
        }),
        new Action({
            id: CoreActionIds.OPEN_CODE_THEME_SELECTOR,
            category: `General`,
            actionHandlers: new Map([
                [
                    `GlobalOpenCodeThemeSelector`,
                    {
                        id: `GlobalOpenCodeThemeSelector`,
                        executeAction: () =>
                            provider.changeActiveModal(CoreModalTypes.codeThemeSelector),
                        getState: () => ({ visibility: ActionVisibility.Shown })
                    }
                ]
            ])
        }),
        new Action({
            id: CoreActionIds.OPEN_SETTINGS,
            category: `General`,
            actionHandlers: new Map([
                [
                    `GlobalOpenSettings`,
                    {
                        id: `GlobalOpenSettings`,
                        executeAction: () => provider.changeActiveModal(CoreModalTypes.settings),
                        getState: () => ({ visibility: ActionVisibility.Shown })
                    }
                ]
            ])
        }),
        new Action({
            id: CoreActionIds.OPEN_PRIMARY_MENU,
            category: `General`
        }),
        new Action({
            id: CoreActionIds.LOGIN,
            category: `User`,
            actionHandlers: new Map([
                [
                    `GlobalLogin`,
                    {
                        id: `GlobalLogin`,
                        getState: () => {
                            if (!provider.props.authConfigured) {
                                return { visibility: ActionVisibility.Hidden };
                            }
                            if (provider.props.auth?.isAuthenticated) {
                                return {
                                    visibility: ActionVisibility.Disabled,
                                    disabledReasonText: `Already logged in`
                                };
                            }
                            return { visibility: ActionVisibility.Shown };
                        },
                        executeAction: () => {
                            if (!provider.props.auth) {
                                log.warn(`No authentication provider configured`);
                                return;
                            }
                            signinRedirectSavePath(
                                provider.props.auth.signinRedirect,
                                postLoginRedirectStorageKey
                            );
                        }
                    }
                ]
            ])
        }),
        new Action({
            id: CoreActionIds.LOGOUT,
            category: `User`,
            actionHandlers: new Map([
                [
                    `GlobalLogout`,
                    {
                        id: `GlobalLogout`,
                        getState: () => {
                            if (!provider.props.authConfigured) {
                                return { visibility: ActionVisibility.Hidden };
                            }
                            if (!provider.props.auth?.isAuthenticated) {
                                return {
                                    visibility: ActionVisibility.Disabled,
                                    disabledReasonText: `Not logged in`
                                };
                            }
                            return { visibility: ActionVisibility.Shown };
                        },
                        executeAction: () => {
                            provider.props.auth?.signoutRedirect();
                        }
                    }
                ]
            ])
        }),
        new Action({
            id: CoreActionIds.OPEN_DEV_TOOLS,
            category: `Developer`,
            actionHandlers: new Map([
                [
                    `GlobalOpenDevTools`,
                    {
                        id: `GlobalOpenDevTools`,
                        executeAction: () => provider.changeActiveModal(CoreModalTypes.devTools),
                        getState: () => ({ visibility: ActionVisibility.Shown })
                    }
                ]
            ])
        }),
        // Undo / redo / history-open are built-in actions that delegate
        // directly to the ActionManager. doNotTrackUsage=true keeps them
        // out of the command-palette MRU (they always live at the top of
        // the palette via their dedicated category instead).
        new Action({
            id: CoreActionIds.UNDO,
            category: `History`,
            doNotTrackUsage: true,
            actionHandlers: new Map([
                [
                    `GlobalUndo`,
                    {
                        id: `GlobalUndo`,
                        executeAction: () => {
                            void provider.actionManager.undo();
                        },
                        getState: () => ({
                            visibility:
                                provider.actionManager.getUndoStack().length > 0
                                    ? ActionVisibility.Shown
                                    : ActionVisibility.Disabled,
                            disabledReasonText:
                                provider.actionManager.getUndoStack().length === 0
                                    ? `Nothing to undo`
                                    : undefined
                        })
                    }
                ]
            ])
        }),
        new Action({
            id: CoreActionIds.REDO,
            category: `History`,
            doNotTrackUsage: true,
            actionHandlers: new Map([
                [
                    `GlobalRedo`,
                    {
                        id: `GlobalRedo`,
                        executeAction: () => {
                            void provider.actionManager.redo();
                        },
                        getState: () => ({
                            visibility:
                                provider.actionManager.getRedoStack().length > 0
                                    ? ActionVisibility.Shown
                                    : ActionVisibility.Disabled,
                            disabledReasonText:
                                provider.actionManager.getRedoStack().length === 0
                                    ? `Nothing to redo`
                                    : undefined
                        })
                    }
                ]
            ])
        }),
        new Action({
            id: CoreActionIds.OPEN_HISTORY,
            category: `History`,
            actionHandlers: new Map([
                [
                    `GlobalOpenHistory`,
                    {
                        id: `GlobalOpenHistory`,
                        executeAction: () => provider.changeActiveModal(CoreModalTypes.history),
                        getState: () => ({ visibility: ActionVisibility.Shown })
                    }
                ]
            ])
        }),
        // Worked example of the undoable-action contract — dispatch this
        // instead of calling `setTheme` directly to get Ctrl+Z support for
        // free. ThemePicker's existing direct-call path is unchanged; this
        // is an opt-in surface for callers that want reversal.
        new Action({
            id: CoreActionIds.SET_THEME,
            category: `Appearance`,
            actionHandlers: new Map([
                [
                    `GlobalSetTheme`,
                    {
                        id: `GlobalSetTheme`,
                        getState: () => ({ visibility: ActionVisibility.Shown }),
                        executeAction: (_event, _scope, payload) => {
                            const args = parseThemePayload(payload, `SET_THEME`);
                            if (!args) return;
                            const themes = provider.props.themes;
                            const nextTheme = themes.find((theme) => theme.id === args.themeId);
                            if (!nextTheme) {
                                log.warn(
                                    `SET_THEME: unknown themeId '${args.themeId}'; available: ${themes.map((theme) => theme.id).join(`, `)}`
                                );
                                return;
                            }
                            const previousThemeId = provider.state.currentTheme.id;
                            void provider.setTheme(nextTheme);
                            return {
                                id: ``,
                                actionId: CoreActionIds.SET_THEME,
                                forwardPayload: { themeId: args.themeId },
                                inversePayload: { themeId: previousThemeId },
                                timestamp: Date.now(),
                                describe: {
                                    labelKey: `actions.${CoreActionIds.SET_THEME}`,
                                    params: { themeId: args.themeId }
                                }
                            };
                        },
                        invertAction: (inversePayload) => {
                            const args = parseThemePayload(
                                inversePayload,
                                `SET_THEME.invertAction`
                            );
                            if (!args) return;
                            const themes = provider.props.themes;
                            const previousTheme = themes.find(
                                (theme) => theme.id === args.themeId
                            );
                            if (!previousTheme) {
                                // Log the id for developer debugging but throw
                                // a generic message — the toast surface should
                                // not echo internal theme ids back to the user.
                                log.warn(
                                    `SET_THEME.invertAction: previous theme '${args.themeId}' is no longer available`
                                );
                                throw new Error(`Previous theme is no longer available`);
                            }
                            return provider.setTheme(previousTheme);
                        }
                    }
                ]
            ])
        }),
        // JSON paste in SettingsPanel goes through here so Ctrl+Z reverts
        // the entire paste in one step (instead of leaving the user to
        // hand-edit back). The previous blob is captured at dispatch time
        // and used verbatim as the inverse — replaceBlob is idempotent
        // against its input, so the reverse is a straight re-apply.
        new Action({
            id: CoreActionIds.REPLACE_SETTINGS_BLOB,
            category: `Settings`,
            // Don't pollute the command-palette MRU with infrastructure
            // actions — the user pastes JSON once or twice, not as a
            // recurring workflow step.
            doNotTrackUsage: true,
            actionHandlers: new Map([
                [
                    `GlobalReplaceSettingsBlob`,
                    {
                        id: `GlobalReplaceSettingsBlob`,
                        getState: () => ({ visibility: ActionVisibility.Shown }),
                        executeAction: (_event, _scope, payload) => {
                            const nextBlob = parseBlobPayload<SettingsBlob>(
                                payload,
                                `REPLACE_SETTINGS_BLOB`
                            );
                            if (!nextBlob) return;
                            const previousBlob = provider.settingsManager.getBlob();
                            // `replaceBlob` throws on validation failure;
                            // let it propagate so the caller surfaces the
                            // error (SettingsPanel already wraps the call
                            // in try/catch for `SettingsBlobValidationError`).
                            provider.settingsManager.replaceBlob(nextBlob);
                            return {
                                id: ``,
                                actionId: CoreActionIds.REPLACE_SETTINGS_BLOB,
                                forwardPayload: { blob: nextBlob },
                                inversePayload: { blob: previousBlob },
                                timestamp: Date.now(),
                                describe: {
                                    labelKey: `actions.${CoreActionIds.REPLACE_SETTINGS_BLOB}`
                                }
                            };
                        },
                        invertAction: (inversePayload) => {
                            const previousBlob = parseBlobPayload<SettingsBlob>(
                                inversePayload,
                                `REPLACE_SETTINGS_BLOB.invertAction`
                            );
                            if (!previousBlob) return;
                            provider.settingsManager.replaceBlob(previousBlob);
                        }
                    }
                ]
            ])
        })
    ];
};

/**
 * Runtime guard for the SET_THEME payload shape. `as` casts only widen
 * types at compile time — a malformed payload from a JS caller (or from
 * a corrupted persisted entry) would silently miss the `?.themeId`
 * chain. Logging at `error` level surfaces misuse in the console.
 */
const parseThemePayload = (
    payload: unknown,
    actionLabel: string
): { themeId: string } | undefined => {
    if (!payload || typeof payload !== `object`) {
        log.error(`${actionLabel} payload must be an object, got ${typeof payload}`);
        return undefined;
    }
    const candidate = payload as { themeId?: unknown };
    if (typeof candidate.themeId !== `string` || candidate.themeId.length === 0) {
        log.error(
            `${actionLabel} payload.themeId must be a non-empty string, got ${typeof candidate.themeId}`
        );
        return undefined;
    }
    return { themeId: candidate.themeId };
};

/**
 * Runtime guard for the REPLACE_SETTINGS_BLOB payload shape. Returns
 * the unwrapped blob (typed loosely as Parameters[0] of replaceBlob —
 * `replaceBlob` itself runs `validateBlob` and rejects malformed input
 * with `SettingsBlobValidationError`, so the runtime safety net lives
 * in the manager, not here).
 */
const parseBlobPayload = <P>(
    payload: unknown,
    actionLabel: string
): P | undefined => {
    if (!payload || typeof payload !== `object`) {
        log.error(`${actionLabel} payload must be an object, got ${typeof payload}`);
        return undefined;
    }
    const candidate = payload as { blob?: unknown };
    if (!candidate.blob || typeof candidate.blob !== `object`) {
        log.error(
            `${actionLabel} payload.blob must be an object, got ${typeof candidate.blob}`
        );
        return undefined;
    }
    return candidate.blob as P;
};

export const coreDefaultHotkeys: HotkeyConfig = {
    [CoreActionIds.OPEN_COMMAND_PALETTE]: {
        keyCombinations: [`mod+shift+p`, `mod+k`]
    },
    [CoreActionIds.UNDO]: {
        keyCombinations: [`mod+z`]
    },
    [CoreActionIds.REDO]: {
        keyCombinations: [`mod+shift+z`]
    }
};
