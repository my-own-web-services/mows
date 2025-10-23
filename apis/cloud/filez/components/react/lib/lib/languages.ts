import { SELECTED_LANGUAGE_LOCAL_STORAGE_KEY } from "./constants.ts";
import { ActionIds } from "./defaultActions.ts";

export interface Translation {
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
        [K in ActionIds]: string;
    } & {
        [key: string]: string;
    };
    commandPalette: {
        placeholder: string;
        noResults: string;
        suggestions: string;
        recentCommands: string;
    };
    resourceTags: {
        badges: string;
        text: string;
        selected: string;
        addToAll: string;
        removeFromAll: string;
        saveTextTags: string;
        cancel: string;
        searchPlaceholder: string;
        clearSearch: string;
    };
    upload: {
        dropFilesHere: string;
        dropFoldersHere: string;
        orClickToSelect: string;
        orClickToSelectFolder: string;
        selectFiles: string;
        removeFile: string;
        uploadFiles: string;
        dropFilesOrFoldersHere: string;
        orUseButtonsBelow: string;
        selectAll: string;
        selectFileGroup: string;
        dragToResize: string;
        showPreviews: string;
        status: {
            pending: string;
            uploading: string;
            completed: string;
            error: string;
        };
    };
    storageLocationPicker: {
        title: string;
        selectStorageLocation: string;
        noStorageLocationFound: string;
        loading: string;
    };
    storageQuotaPicker: {
        title: string;
        selectStorageQuota: string;
        noStorageQuotaFound: string;
        loading: string;
    };
    fileGroupPicker: {
        title: string;
        selectFileGroup: string;
        noFileGroupFound: string;
        loading: string;
    };
    fileGroupCreate: {
        createFileGroup: string;
        title: string;
        description: string;
        nameLabel: string;
        namePlaceholder: string;
        nameRequired: string;
        nameTooLong: string;
        createFailed: string;
        cancel: string;
        create: string;
        creating: string;
    };
    common: {
        files: {
            delete: (fileCount: number) => string;
        };
    };
}

export const getBrowserLanguage = (): Language => {
    const userSelectedLanguage = localStorage.getItem(SELECTED_LANGUAGE_LOCAL_STORAGE_KEY);
    if (userSelectedLanguage) {
        const lang = languages.find((lang) => lang.code === userSelectedLanguage);
        if (lang) return lang;
    }

    const languageCode = navigator.language || navigator.languages?.[0] || "en-US";
    return (
        languages.find((lang) => lang.code === languageCode) ||
        languages.find((lang) => lang.code === languageCode.split("-")[0]) ||
        languages.find((lang) => lang.code === "en-US")!
    );
};

export interface Language {
    code: string;
    originalName: string;
    englishName: string;
    emoji: string;
    import: () => Promise<{ default: Translation }>;
}

export const languages: Language[] = [
    {
        code: "de",
        originalName: "Deutsch",
        englishName: "German",
        emoji: "🇩🇪",
        import: () => import("./languages/de/default.ts")
    },
    {
        code: "en-US",
        originalName: "English (US)",
        englishName: "English (US)",
        emoji: "🇺🇸",
        import: () => import("./languages/en-US/default.ts")
    }
];
