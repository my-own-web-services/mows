import { Action, ActionVisibility } from "./ActionManager";
import { log } from "../logging";
import type { MowsClientManagerBase } from "./MowsContext";
import type { HotkeyConfig } from "./HotkeyManager";
import type { SigninRedirectArgs } from "oidc-client-ts";

export enum CoreActionIds {
    OPEN_COMMAND_PALETTE = `mows.openCommandPalette`,
    OPEN_KEYBOARD_SHORTCUTS = `mows.openKeyboardShortcuts`,
    OPEN_LANGUAGE_SETTINGS = `mows.openLanguageSettings`,
    OPEN_THEME_SELECTOR = `mows.openThemeSelector`,
    OPEN_PRIMARY_MENU = `mows.openPrimaryMenu`,
    LOGIN = `mows.user.login`,
    LOGOUT = `mows.user.logout`,
    OPEN_DEV_TOOLS = `mows.developer.openDevTools`
}

export const CoreModalTypes = {
    keyboardShortcutEditor: `keyboardShortcutEditor`,
    themeSelector: `themeSelector`,
    languageSelector: `languageSelector`,
    devTools: `devTools`
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
        })
    ];
};

export const coreDefaultHotkeys: HotkeyConfig = {
    [CoreActionIds.OPEN_COMMAND_PALETTE]: {
        keyCombinations: [`ctrl+shift+p`, `meta+k`]
    }
};
