import { Action } from "./filezContext/ActionManager";
import type { FilezClientManagerBase } from "./filezContext/FilezContext";
import { log } from "./logging";
import { signinRedirectSavePath } from "./utils";

export const defineApplicationActions = (
    filezContextProvider: FilezClientManagerBase
): Action[] => {
    return [
        new Action({
            id: ActionIds.OPEN_COMMAND_PALETTE,
            category: "General",
            doNotTrackUsage: true
        }),
        new Action({
            id: ActionIds.DELETE_FILES,
            category: "File List",
            doNotTrackUsage: false
        }),
        new Action({
            id: ActionIds.OPEN_KEYBOARD_SHORTCUTS,
            category: "General",
            actionHandlers: new Map([
                [
                    "GlobalOpenKeyboardShortcuts",
                    {
                        id: "GlobalOpenKeyboardShortcuts",
                        executeAction: () =>
                            filezContextProvider.changeActiveModal("keyboardShortcutEditor"),
                        getState: () => ({ visibility: "active" })
                    }
                ]
            ])
        }),
        new Action({
            id: ActionIds.OPEN_LANGUAGE_SETTINGS,
            category: "General",
            actionHandlers: new Map([
                [
                    "GlobalOpenLanguageSettings",
                    {
                        id: "GlobalOpenLanguageSettings",
                        executeAction: () =>
                            filezContextProvider.changeActiveModal("languageSelector"),
                        getState: () => ({ visibility: "active" })
                    }
                ]
            ])
        }),
        new Action({
            id: ActionIds.OPEN_THEME_SELECTOR,
            category: "General",
            actionHandlers: new Map([
                [
                    "GlobalOpenThemeSelector",
                    {
                        id: "GlobalOpenThemeSelector",
                        executeAction: () =>
                            filezContextProvider.changeActiveModal("themeSelector"),
                        getState: () => ({ visibility: "active" })
                    }
                ]
            ])
        }),
        new Action({
            id: ActionIds.OPEN_PRIMARY_MENU,
            category: "General"
        }),
        new Action({
            id: ActionIds.LOGIN,
            category: "User",
            actionHandlers: new Map([
                [
                    "GlobalLogin",
                    {
                        id: "GlobalLogin",
                        getState: () => {
                            if (filezContextProvider.props.auth?.isAuthenticated) {
                                return {
                                    visibility: "disabled",
                                    disabledReason: "Already logged in"
                                };
                            }
                            return { visibility: "active" };
                        },
                        executeAction: () => {
                            if (!filezContextProvider.props.auth) {
                                log.warn("No authentication provider configured");
                                return;
                            }
                            signinRedirectSavePath(filezContextProvider.props.auth.signinRedirect);
                        }
                    }
                ]
            ])
        }),
        new Action({
            id: ActionIds.LOGOUT,
            category: "User",
            actionHandlers: new Map([
                [
                    "GlobalLogout",
                    {
                        id: "GlobalLogout",
                        getState: () => {
                            if (!filezContextProvider.props.auth?.isAuthenticated) {
                                return { visibility: "disabled", disabledReason: "Not logged in" };
                            }
                            return { visibility: "active" };
                        },
                        executeAction: () => {
                            filezContextProvider.props.auth?.signoutRedirect();
                        }
                    }
                ]
            ])
        }),
        new Action({
            id: ActionIds.CREATE_FILE_GROUP,
            category: "File Groups",
            actionHandlers: new Map([
                [
                    "GlobalCreateFileGroup",
                    {
                        id: "GlobalCreateFileGroup",
                        executeAction: () =>
                            filezContextProvider.changeActiveModal("fileGroupCreate"),
                        getState: () => ({ visibility: "active" })
                    }
                ]
            ])
        })
    ];
};

export enum ActionIds {
    OPEN_COMMAND_PALETTE = "filez.openCommandPalette",
    OPEN_KEYBOARD_SHORTCUTS = "filez.openKeyboardShortcuts",
    OPEN_LANGUAGE_SETTINGS = "filez.openLanguageSettings",
    OPEN_THEME_SELECTOR = "filez.openThemeSelector",
    OPEN_PRIMARY_MENU = "filez.openPrimaryMenu",
    LOGIN = "filez.user.login",
    LOGOUT = "filez.user.logout",
    DELETE_FILES = "filez.files.delete",
    CREATE_FILE_GROUP = "filez.fileGroups.create"
}
