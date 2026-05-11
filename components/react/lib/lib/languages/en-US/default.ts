import type { BaseTranslation } from "../../languages";
import { CoreActionIds } from "../../mowsContext/coreActions";

const translation: BaseTranslation = {
    primaryMenu: {
        loggedInAs: `Signed in as`,
        copyUserId: {
            label: `Copy User ID`,
            title: `Copy User ID to clipboard`
        },
        profile: `Profile`,
        language: `Language`,
        login: `Login`,
        logout: `Logout`,
        theme: `Theme`,
        openMenu: `Open menu`,
        switchUser: `Switch User`,
        developerTools: `Developer Tools`,
        developer: `Developer`
    },
    languagePicker: {
        title: `Language Selector`,
        noLanguageFound: `No language found`,
        selectLanguage: `Select language`
    },
    themePicker: {
        title: `Theme Selector`,
        selectTheme: `Select theme`,
        noThemeFound: `No theme found`
    },
    codeThemePicker: {
        title: `Code Theme Selector`,
        label: `Code theme`,
        selectCodeTheme: `Select code theme`,
        noCodeThemeFound: `No code theme found`
    },
    settings: {
        title: `Settings`,
        description: `Configure all preferences in one place`,
        formTab: `Form`,
        jsonTab: `JSON`,
        save: `Save`,
        reset: `Reset`,
        invalidJson: `Invalid JSON`,
        sections: {
            appearance: `Appearance`,
            language: `Language`,
            codeEditor: `Code editor`
        },
        labels: {
            theme: `Theme`,
            language: `Language`,
            codeTheme: `Code theme`,
            showWhitespace: `Show whitespace`,
            wrap: `Wrap long lines`,
            showLineNumbers: `Show line numbers`
        }
    },
    keyboardShortcuts: {
        label: `Keyboard Shortcuts`,
        title: `Keyboard Shortcuts`,
        resetAll: `Reset All`,
        edit: `Edit`,
        reset: `Reset`,
        delete: `Delete`,
        hotkeyDialog: {
            editTitle: `Edit Keyboard Shortcut`,
            addTitle: `Add New Hotkey`,
            editDescription: `Press the key combination you want to use for this action.`,
            addDescription: `Add a new hotkey for`,
            pressKeys: `Press keys...`,
            cancel: `Cancel`,
            save: `Save`,
            addHotkey: `Add Hotkey`,
            keyAlreadyInUse: `This combination is already used by "{action}"`
        }
    },
    actions: {
        [CoreActionIds.OPEN_COMMAND_PALETTE]: `Open command palette`,
        [CoreActionIds.OPEN_KEYBOARD_SHORTCUTS]: `Open keyboard shortcuts`,
        [CoreActionIds.OPEN_LANGUAGE_SETTINGS]: `Open language settings`,
        [CoreActionIds.OPEN_THEME_SELECTOR]: `Open theme selector`,
        [CoreActionIds.OPEN_PRIMARY_MENU]: `Open primary menu`,
        [CoreActionIds.LOGIN]: `Login`,
        [CoreActionIds.LOGOUT]: `Logout`,
        [CoreActionIds.OPEN_DEV_TOOLS]: `Open developer tools`,
        [CoreActionIds.OPEN_CODE_THEME_SELECTOR]: `Open code theme selector`,
        [CoreActionIds.OPEN_SETTINGS]: `Open settings`
    },
    commandPalette: {
        placeholder: `Type a command or search...`,
        noResults: `No results found.`,
        suggestions: `Suggestions`,
        recentCommands: `Recent Commands`
    },
    devPanel: {
        tasks: {
            title: `Tasks`,
            description: `Search, run, and monitor development tasks`,
            searchPlaceholder: `Search tasks...`,
            runAllTitle: `Run All Tasks`,
            runAllButton: `Run All Tasks`,
            running: `Running...`,
            individualTitle: `Individual Tasks`,
            noTasksFound: `No tasks found matching`,
            tasksCount: `tasks`
        },
        apiTests: {
            title: `API Tests`,
            description: `Search, run, and monitor API integration tests`,
            searchPlaceholder: `Search tests...`,
            runAllTitle: `Run All Tests`,
            runAllButton: `Run All Tests`,
            running: `Running...`,
            individualTitle: `Individual Tests`,
            noTestsFound: `No tests found matching`,
            testsCount: `tests`,
            runMode: {
                sequential: `Sequential (one at a time)`,
                parallel: `Parallel (all at once)`
            }
        },
        status: {
            idle: `Idle`,
            running: `Running`,
            success: `Success`,
            error: `Error`
        }
    },
    loggingConfig: {
        title: `Logging Configuration`,
        description: `Configure logging levels and file-specific filters`,
        defaultLevel: `Default Log Level`,
        fileFilters: `File-Specific Filters`,
        noFileFilters: `No file-specific filters configured`,
        addFileFilter: `Add File Filter`,
        filePatternPlaceholder: `e.g., HotkeyManager, FileViewer`,
        remove: `Remove`,
        add: `Add`
    },
    devTools: {
        title: `Developer Tools`,
        description: `Development tasks, API tests, and logging configuration`
    },
    resourceList: {
        reload: `Reload`
    },
    keys: {
        ctrl: `Ctrl`,
        alt: `Alt`,
        shift: `Shift`,
        meta: `Win`,
        enter: `Enter`,
        esc: `Esc`,
        tab: `Tab`,
        space: `Space`,
        backspace: `Backspace`
    }
};

export default translation;
