import type { Translation } from "@/lib/languages";

const translation: Translation = {
    primaryMenu: {
        loggedInAs: "Angemeldet als",
        copyUserId: {
            label: "Benutzer ID kopieren",
            title: "Benutzer ID in die Zwischenablage kopieren"
        },
        profile: "Profil",
        language: "Sprache",
        login: "Anmelden",
        logout: "Abmelden",
        theme: "Design",
        openMenu: "Menü öffnen",
        switchUser: "Benutzer wechseln",
        developerTools: "Entwicklerwerkzeuge",
        developer: "Entwickler"
    },
    languagePicker: {
        noLanguageFound: "Keine Sprache gefunden",
        selectLanguage: "Sprache auswählen"
    },
    themePicker: {
        selectTheme: "Design auswählen",
        noThemeFound: "Kein Design gefunden"
    },
    keyboardShortcuts: {
        label: "Tastenkombinationen"
    }
};

export default translation;
