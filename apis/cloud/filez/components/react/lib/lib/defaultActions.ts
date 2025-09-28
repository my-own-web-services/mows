import { HOTKEY_DEFAULT_SCOPE } from "./constants";
import type { ActionDefinition } from "./filezContext/ActionManager";
import type { FilezClientManagerBase } from "./filezContext/FilezContext";
import { log } from "./logging";
import { signinRedirectSavePath } from "./utils";

export const defineApplicationActions = (
    filezContextProvider: FilezClientManagerBase
): ActionDefinition[] => {
    return [
        {
            id: ActionIds.OPEN_COMMAND_PALETTE,
            category: "General",
            scope: HOTKEY_DEFAULT_SCOPE,
            doNotTrackUsage: true
        },
        {
            id: ActionIds.OPEN_KEYBOARD_SHORTCUTS,
            category: "General",
            scope: HOTKEY_DEFAULT_SCOPE,
            handler: () => filezContextProvider.changeActiveModal("keyboardShortcutEditor")
        },
        {
            id: ActionIds.OPEN_LANGUAGE_SETTINGS,
            category: "General",
            scope: HOTKEY_DEFAULT_SCOPE,
            handler: () => filezContextProvider.changeActiveModal("languageSelector")
        },
        {
            id: ActionIds.OPEN_THEME_SELECTOR,
            category: "General",
            scope: HOTKEY_DEFAULT_SCOPE,
            handler: () => filezContextProvider.changeActiveModal("themeSelector")
        },
        {
            id: ActionIds.OPEN_PRIMARY_MENU,
            category: "General",
            scope: HOTKEY_DEFAULT_SCOPE
        },
        {
            id: ActionIds.LOGIN,
            category: "User",
            scope: HOTKEY_DEFAULT_SCOPE,
            handler: () => {
                if (!filezContextProvider.props.auth) {
                    log.warn("No authentication provider configured");
                    return;
                }
                signinRedirectSavePath(filezContextProvider.props.auth.signinRedirect);
            }
        },
        {
            id: ActionIds.LOGOUT,
            category: "User",
            scope: HOTKEY_DEFAULT_SCOPE,
            handler: () => {
                filezContextProvider.props.auth?.signoutRedirect();
            }
        }
    ];
};

export enum ActionIds {
    OPEN_COMMAND_PALETTE = "filez.openCommandPalette",
    OPEN_KEYBOARD_SHORTCUTS = "filez.openKeyboardShortcuts",
    OPEN_LANGUAGE_SETTINGS = "filez.openLanguageSettings",
    OPEN_THEME_SELECTOR = "filez.openThemeSelector",
    OPEN_PRIMARY_MENU = "filez.openPrimaryMenu",
    LOGIN = "filez.user.login",
    LOGOUT = "filez.user.logout"
}
