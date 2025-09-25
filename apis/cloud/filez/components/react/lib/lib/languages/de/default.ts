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
        label: "Tastenkombinationen",
        title: "Tastenkombinationen",
        resetAll: "Alle zurücksetzen",
        edit: "Bearbeiten",
        reset: "Zurücksetzen",
        hotkeyDialog: {
            editTitle: "Tastenkombination bearbeiten",
            addTitle: "Neue Tastenkombination hinzufügen",
            editDescription:
                "Drücken Sie die Tastenkombination, die Sie für diese Aktion verwenden möchten.",
            addDescription: "Neue Tastenkombination hinzufügen für",
            pressKeys: "Tasten drücken...",
            cancel: "Abbrechen",
            save: "Speichern",
            addHotkey: "Tastenkombination hinzufügen",
            keyAlreadyInUse: 'Diese Tastenkombination wird bereits von "{action}" verwendet'
        }
    },
    actions: {
        "app.openPrimaryMenu": "Hauptmenü öffnen",
        "app.openCommandPalette": "Befehlspalette öffnen",
        "app.openKeyboardShortcuts": "Tastenkombinationen öffnen"
    },
    commandPalette: {
        placeholder: "Befehl eingeben oder suchen...",
        noResults: "Keine Ergebnisse gefunden.",
        suggestions: "Vorschläge"
    }
};

export default translation;
