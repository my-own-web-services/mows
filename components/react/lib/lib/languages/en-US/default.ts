import type { BaseTranslation } from "../../languages";
import { CoreActionIds } from "../../mowsContext/coreActions";

const translation: BaseTranslation = {
    videoViewer: {
        play: `Play`,
        pause: `Pause`,
        mute: `Mute`,
        unmute: `Unmute`,
        volume: `Volume`,
        seek: `Seek`,
        seekTo: `Seek to`,
        quality: `Quality`,
        qualityAuto: `Auto`,
        captions: `Subtitles`,
        captionsOff: `Off`,
        playbackRate: `Playback speed`,
        pictureInPicture: `Picture in picture`,
        fullscreen: `Enter fullscreen`,
        exitFullscreen: `Exit fullscreen`,
        errorTitle: `Playback failed`,
        errorRetry: `Retry`,
        loading: `Loading…`
    },
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
    mapStylePicker: {
        title: `Map Style Selector`,
        label: `Map style`,
        selectMapStyle: `Select map style`,
        noMapStyleFound: `No map style found`
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
            codeEditor: `Code editor`,
            notifications: `Notifications`,
            map: `Map`
        },
        labels: {
            theme: `Theme`,
            language: `Language`,
            codeTheme: `Code theme`,
            showWhitespace: `Show whitespace`,
            wrap: `Wrap long lines`,
            showLineNumbers: `Show line numbers`,
            bracketPairColorization: `Colorize bracket pairs`,
            toastPosition: `Toast position`,
            mapStyle: `Map style`
        },
        toastPositions: {
            topLeft: `Top left`,
            topCenter: `Top center`,
            topRight: `Top right`,
            bottomLeft: `Bottom left`,
            bottomCenter: `Bottom center`,
            bottomRight: `Bottom right`
        },
        /** Fallback label used in `<SettingsPanel>` for app-registered
         * settings whose schema entry omitted the `group` field. */
        appSectionDefaultGroup: `Other`
    },
    keyboardShortcuts: {
        label: `Keyboard Shortcuts`,
        title: `Keyboard Shortcuts`,
        resetAll: `Reset All`,
        edit: `Edit`,
        reset: `Reset`,
        delete: `Delete`,
        searchPlaceholder: `Search actions...`,
        searchAriaLabel: `Search actions`,
        actionNotFound: `Action not found`,
        noActionsFound: `No actions found matching "{searchQuery}"`,
        addHotkeyButton: `Add Hotkey`,
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
    consoleManager: {
        split: `Split`,
        kill: `Kill`,
        rename: `Rename`,
        splitTerminal: `Split Terminal`,
        killTerminal: `Kill Terminal`
    },
    dateTimePicker: {
        ariaLabel: `Date and time`,
        timezoneLabel: `Timezone`
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
        reload: `Reload`,
        crossListDoesNotAcceptDrops: `does not accept drops`
    },
    pageIndex: {
        heading: `On this page`,
        ariaLabel: `On this page`
    },
    expandableCode: {
        expand: `Expand`,
        collapse: `Collapse`
    },
    keyComboRecorder: {
        heading: `Record key combos`,
        hint: `Click "Start recording" then press any combos on your keyboard — each press is appended to the list below. A modifier key released alone (e.g. just Shift) is also captured. Click "Stop recording" when you're done.`,
        start: `Start recording`,
        stop: `Stop recording`,
        clear: `Clear`,
        listening: `Listening — press any key combo…`
    },
    keys: {
        ctrl: `Ctrl`,
        alt: `Alt`,
        altgr: `AltGr`,
        fn: `Fn`,
        shift: `Shift`,
        meta: `Win`,
        enter: `Enter`,
        esc: `Esc`,
        tab: `Tab`,
        space: `Space`,
        backspace: `Backspace`,
        del: `Del`,
        insert: `Ins`,
        home: `Home`,
        end: `End`,
        pageUp: `Pg`,
        pageDown: `Pg`,
        pause: `Pause`,
        scrollLock: `ScrLk`,
        numLock: `NumLk`,
        printScreen: `PrtSc`
    }
};

export default translation;
