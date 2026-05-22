export interface BaseTranslation {
    videoViewer: {
        play: string;
        pause: string;
        mute: string;
        unmute: string;
        volume: string;
        seek: string;
        seekTo: string;
        quality: string;
        qualityAuto: string;
        captions: string;
        captionsOff: string;
        playbackRate: string;
        pictureInPicture: string;
        fullscreen: string;
        exitFullscreen: string;
        errorTitle: string;
        errorRetry: string;
        loading: string;
    };
    primaryMenu: {
        loggedInAs: string;
        copyUserId: {
            label: string;
            title: string;
        };
        profile: string;
        language: string;
        login: string;
        logout: string;
        theme: string;
        openMenu: string;
        switchUser: string;
        developerTools: string;
        developer: string;
    };
    languagePicker: {
        title: string;
        noLanguageFound: string;
        selectLanguage: string;
    };
    themePicker: {
        title: string;
        selectTheme: string;
        noThemeFound: string;
    };
    codeThemePicker: {
        title: string;
        label: string;
        selectCodeTheme: string;
        noCodeThemeFound: string;
    };
    mapStylePicker: {
        title: string;
        label: string;
        selectMapStyle: string;
        noMapStyleFound: string;
    };
    settings: {
        title: string;
        description: string;
        formTab: string;
        jsonTab: string;
        save: string;
        reset: string;
        invalidJson: string;
        sections: {
            appearance: string;
            language: string;
            codeEditor: string;
            notifications: string;
            map: string;
        };
        labels: {
            theme: string;
            language: string;
            codeTheme: string;
            showWhitespace: string;
            wrap: string;
            showLineNumbers: string;
            bracketPairColorization: string;
            toastPosition: string;
            mapStyle: string;
        };
        toastPositions: {
            topLeft: string;
            topCenter: string;
            topRight: string;
            bottomLeft: string;
            bottomCenter: string;
            bottomRight: string;
        };
    };
    keyboardShortcuts: {
        label: string;
        title: string;
        resetAll: string;
        edit: string;
        reset: string;
        delete: string;
        searchPlaceholder: string;
        searchAriaLabel: string;
        actionNotFound: string;
        noActionsFound: string;
        addHotkeyButton: string;
        hotkeyDialog: {
            editTitle: string;
            addTitle: string;
            editDescription: string;
            addDescription: string;
            pressKeys: string;
            cancel: string;
            save: string;
            addHotkey: string;
            keyAlreadyInUse: string;
        };
    };
    consoleManager: {
        split: string;
        kill: string;
        rename: string;
        splitTerminal: string;
        killTerminal: string;
    };
    dateTimePicker: {
        ariaLabel: string;
        timezoneLabel: string;
    };
    actions: {
        [key: string]: string;
    };
    commandPalette: {
        placeholder: string;
        noResults: string;
        suggestions: string;
        recentCommands: string;
    };
    devPanel: {
        tasks: {
            title: string;
            description: string;
            searchPlaceholder: string;
            runAllTitle: string;
            runAllButton: string;
            running: string;
            individualTitle: string;
            noTasksFound: string;
            tasksCount: string;
        };
        apiTests: {
            title: string;
            description: string;
            searchPlaceholder: string;
            runAllTitle: string;
            runAllButton: string;
            running: string;
            individualTitle: string;
            noTestsFound: string;
            testsCount: string;
            runMode: {
                sequential: string;
                parallel: string;
            };
        };
        status: {
            idle: string;
            running: string;
            success: string;
            error: string;
        };
    };
    loggingConfig: {
        title: string;
        description: string;
        defaultLevel: string;
        fileFilters: string;
        noFileFilters: string;
        addFileFilter: string;
        filePatternPlaceholder: string;
        remove: string;
        add: string;
    };
    devTools: {
        title: string;
        description: string;
    };
    resourceList: {
        reload: string;
    };
    pageIndex: {
        heading: string;
        ariaLabel: string;
    };
    expandableCode: {
        expand: string;
        collapse: string;
    };
    keyComboRecorder: {
        heading: string;
        hint: string;
        start: string;
        stop: string;
        clear: string;
        listening: string;
    };
    keys: {
        ctrl: string;
        alt: string;
        altgr: string;
        fn: string;
        shift: string;
        meta: string;
        enter: string;
        esc: string;
        tab: string;
        space: string;
        backspace: string;
        del: string;
        insert: string;
        home: string;
        end: string;
        pageUp: string;
        pageDown: string;
        pause: string;
        scrollLock: string;
        numLock: string;
        printScreen: string;
    };
}

export interface Translation extends BaseTranslation {}

export interface Language {
    code: string;
    originalName: string;
    englishName: string;
    emoji: string;
    import: () => Promise<{ default: Translation }>;
}

export const getBrowserLanguage = (
    languages: Language[],
    selectedLanguageStorageKey: string
): Language => {
    const userSelectedLanguage = localStorage.getItem(selectedLanguageStorageKey);
    if (userSelectedLanguage) {
        const lang = languages.find((lang) => lang.code === userSelectedLanguage);
        if (lang) return lang;
    }

    const languageCode = navigator.language || navigator.languages?.[0] || `en-US`;
    return (
        languages.find((lang) => lang.code === languageCode) ||
        languages.find((lang) => lang.code === languageCode.split(`-`)[0]) ||
        languages.find((lang) => lang.code === `en-US`)!
    );
};
