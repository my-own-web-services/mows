import type { BaseTranslation } from "../../languages";
import { CoreActionIds } from "../../mowsContext/coreActions";

const translation: BaseTranslation = {
    primaryMenu: {
        loggedInAs: `Angemeldet als`,
        copyUserId: {
            label: `Benutzer ID kopieren`,
            title: `Benutzer ID in die Zwischenablage kopieren`
        },
        profile: `Profil`,
        language: `Sprache`,
        login: `Anmelden`,
        logout: `Abmelden`,
        theme: `Design`,
        openMenu: `Menü öffnen`,
        switchUser: `Benutzer wechseln`,
        developerTools: `Entwicklerwerkzeuge`,
        developer: `Entwickler`
    },
    languagePicker: {
        title: `Sprachauswahl`,
        noLanguageFound: `Keine Sprache gefunden`,
        selectLanguage: `Sprache auswählen`
    },
    themePicker: {
        title: `Theme-Auswahl`,
        selectTheme: `Design auswählen`,
        noThemeFound: `Kein Design gefunden`
    },
    codeThemePicker: {
        title: `Code-Theme-Auswahl`,
        label: `Code-Design`,
        selectCodeTheme: `Code-Design auswählen`,
        noCodeThemeFound: `Kein Code-Design gefunden`
    },
    settings: {
        title: `Einstellungen`,
        description: `Alle Einstellungen an einem Ort verwalten`,
        formTab: `Formular`,
        jsonTab: `JSON`,
        save: `Speichern`,
        reset: `Zurücksetzen`,
        invalidJson: `Ungültiges JSON`,
        sections: {
            appearance: `Erscheinungsbild`,
            language: `Sprache`,
            codeEditor: `Code-Editor`
        },
        labels: {
            theme: `Design`,
            language: `Sprache`,
            codeTheme: `Code-Design`,
            showWhitespace: `Leerzeichen anzeigen`,
            wrap: `Lange Zeilen umbrechen`,
            showLineNumbers: `Zeilennummern anzeigen`
        }
    },
    keyboardShortcuts: {
        label: `Tastenkombinationen`,
        title: `Tastenkombinationen`,
        resetAll: `Alle zurücksetzen`,
        edit: `Bearbeiten`,
        reset: `Zurücksetzen`,
        delete: `Löschen`,
        hotkeyDialog: {
            editTitle: `Tastenkombination bearbeiten`,
            addTitle: `Neue Tastenkombination hinzufügen`,
            editDescription:
                `Drücken Sie die Tastenkombination, die Sie für diese Aktion verwenden möchten.`,
            addDescription: `Neue Tastenkombination hinzufügen für`,
            pressKeys: `Tasten drücken...`,
            cancel: `Abbrechen`,
            save: `Speichern`,
            addHotkey: `Tastenkombination hinzufügen`,
            keyAlreadyInUse: `Diese Tastenkombination wird bereits von "{action}" verwendet`
        }
    },
    actions: {
        [CoreActionIds.OPEN_COMMAND_PALETTE]: `Befehlspalette öffnen`,
        [CoreActionIds.OPEN_KEYBOARD_SHORTCUTS]: `Tastenkombinationen öffnen`,
        [CoreActionIds.OPEN_LANGUAGE_SETTINGS]: `Spracheinstellungen öffnen`,
        [CoreActionIds.OPEN_THEME_SELECTOR]: `Theme-Auswahl öffnen`,
        [CoreActionIds.OPEN_PRIMARY_MENU]: `Hauptmenü öffnen`,
        [CoreActionIds.LOGIN]: `Anmelden`,
        [CoreActionIds.LOGOUT]: `Abmelden`,
        [CoreActionIds.OPEN_DEV_TOOLS]: `Entwicklerwerkzeuge öffnen`,
        [CoreActionIds.OPEN_CODE_THEME_SELECTOR]: `Code-Design-Auswahl öffnen`,
        [CoreActionIds.OPEN_SETTINGS]: `Einstellungen öffnen`
    },
    commandPalette: {
        placeholder: `Befehl eingeben oder suchen...`,
        noResults: `Keine Ergebnisse gefunden.`,
        suggestions: `Vorschläge`,
        recentCommands: `Zuletzt verwendet`
    },
    devPanel: {
        tasks: {
            title: `Aufgaben`,
            description: `Entwicklungsaufgaben suchen, ausführen und überwachen`,
            searchPlaceholder: `Aufgaben durchsuchen...`,
            runAllTitle: `Alle Aufgaben ausführen`,
            runAllButton: `Alle Aufgaben ausführen`,
            running: `Wird ausgeführt...`,
            individualTitle: `Einzelne Aufgaben`,
            noTasksFound: `Keine Aufgaben gefunden, die übereinstimmen mit`,
            tasksCount: `Aufgaben`
        },
        apiTests: {
            title: `API-Tests`,
            description: `API-Integrationstests suchen, ausführen und überwachen`,
            searchPlaceholder: `Tests durchsuchen...`,
            runAllTitle: `Alle Tests ausführen`,
            runAllButton: `Alle Tests ausführen`,
            running: `Wird ausgeführt...`,
            individualTitle: `Einzelne Tests`,
            noTestsFound: `Keine Tests gefunden, die übereinstimmen mit`,
            testsCount: `Tests`,
            runMode: {
                sequential: `Sequenziell (nacheinander)`,
                parallel: `Parallel (gleichzeitig)`
            }
        },
        status: {
            idle: `Bereit`,
            running: `Läuft`,
            success: `Erfolgreich`,
            error: `Fehler`
        }
    },
    loggingConfig: {
        title: `Logging-Konfiguration`,
        description: `Log-Level und dateispezifische Filter konfigurieren`,
        defaultLevel: `Standard-Log-Level`,
        fileFilters: `Dateispezifische Filter`,
        noFileFilters: `Keine dateispezifischen Filter konfiguriert`,
        addFileFilter: `Dateifilter hinzufügen`,
        filePatternPlaceholder: `z.B. HotkeyManager, FileViewer`,
        remove: `Entfernen`,
        add: `Hinzufügen`
    },
    devTools: {
        title: `Entwicklerwerkzeuge`,
        description: `Entwicklungsaufgaben, API-Tests und Logging-Konfiguration`
    },
    resourceList: {
        reload: `Neu laden`
    },
    keys: {
        ctrl: `Strg`,
        alt: `Alt`,
        shift: `Umschalt`,
        meta: `Win`,
        enter: `Eingabe`,
        esc: `Esc`,
        tab: `Tab`,
        space: `Leertaste`,
        backspace: `Rücktaste`
    }
};

export default translation;
