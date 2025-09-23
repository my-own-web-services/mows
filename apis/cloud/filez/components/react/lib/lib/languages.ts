import { SELECTED_LANGUAGE_LOCAL_STORAGE_KEY } from "./constants.ts";

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
        noLanguageFound: string;
        selectLanguage: string;
    };
    themePicker: {
        selectTheme: string;
        noThemeFound: string;
    };
    keyboardShortcuts: {
        label: string;
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
