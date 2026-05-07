export interface BaseTranslation {
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
    keyboardShortcuts: {
        label: string;
        title: string;
        resetAll: string;
        edit: string;
        reset: string;
        delete: string;
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
