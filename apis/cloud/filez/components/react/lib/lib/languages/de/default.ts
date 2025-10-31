import { ActionIds } from "@/lib/defaultActions";
import type { Translation } from "@/lib/languages";

const translation: Translation = {
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
        [ActionIds.OPEN_COMMAND_PALETTE]: `Befehlspalette öffnen`,
        [ActionIds.OPEN_KEYBOARD_SHORTCUTS]: `Tastenkombinationen öffnen`,
        [ActionIds.OPEN_LANGUAGE_SETTINGS]: `Spracheinstellungen öffnen`,
        [ActionIds.OPEN_THEME_SELECTOR]: `Theme-Auswahl öffnen`,
        [ActionIds.OPEN_PRIMARY_MENU]: `Hauptmenü öffnen`,
        [ActionIds.LOGIN]: `Anmelden`,
        [ActionIds.LOGOUT]: `Abmelden`,
        [ActionIds.DELETE_FILES]: `Dateien löschen`,
        [ActionIds.CREATE_FILE_GROUP]: `Dateigruppe erstellen`,
        [ActionIds.OPEN_DEV_TOOLS]: `Entwicklerwerkzeuge öffnen`
    },
    commandPalette: {
        placeholder: `Befehl eingeben oder suchen...`,
        noResults: `Keine Ergebnisse gefunden.`,
        suggestions: `Vorschläge`,
        recentCommands: `Zuletzt verwendet`
    },
    resourceTags: {
        badges: `Tags`,
        text: `Text`,
        selected: `ausgewählt`,
        addToAll: `Zu allen hinzufügen`,
        removeFromAll: `Von allen entfernen`,
        saveTextTags: `Speichern`,
        cancel: `Abbrechen`,
        searchPlaceholder: `Tags durchsuchen...`,
        clearSearch: `Suche löschen`
    },
    upload: {
        dropFilesHere: `Dateien hier ablegen`,
        dropFoldersHere: `Ordner hier ablegen`,
        orClickToSelect: `oder klicken zum Auswählen`,
        orClickToSelectFolder: `oder klicken zum Ordner auswählen`,
        selectFiles: `Dateien zum Hochladen auswählen`,
        removeFile: `Datei entfernen`,
        uploadFiles: `Dateien hochladen`,
        dropFilesOrFoldersHere: `Dateien oder Ordner hier ablegen`,
        orUseButtonsBelow: `oder die Schaltflächen unten verwenden`,
        selectAll: `Alle auswählen`,
        selectFileGroup: `Dateigruppe auswählen (optional)`,
        dragToResize: `Ziehen zum Größe ändern`,
        showPreviews: `Vorschau erstellen`,
        status: {
            pending: `Wartend`,
            uploading: `Hochladen`,
            completed: `Abgeschlossen`,
            error: `Fehler`
        }
    },
    storageLocationPicker: {
        title: `Speicherort-Auswahl`,
        selectStorageLocation: `Speicherort auswählen`,
        noStorageLocationFound: `Kein Speicherort gefunden`,
        loading: `Lade Speicherorte...`
    },
    storageQuotaPicker: {
        title: `Speicherkontingent-Auswahl`,
        selectStorageQuota: `Speicherkontingent auswählen`,
        noStorageQuotaFound: `Kein Speicherkontingent gefunden`,
        loading: `Lade Speicherkontingente...`
    },
    fileGroupPicker: {
        title: `Dateigruppen-Auswahl`,
        selectFileGroup: `Dateigruppe auswählen`,
        noFileGroupFound: `Keine Dateigruppe gefunden`,
        loading: `Lade Dateigruppen...`
    },
    fileGroupCreate: {
        createFileGroup: `Dateigruppe erstellen`,
        title: `Neue Dateigruppe erstellen`,
        description: `Erstellen Sie eine neue Dateigruppe, um Ihre Dateien zu organisieren.`,
        nameLabel: `Dateigruppenname`,
        namePlaceholder: `Dateigruppenname eingeben`,
        nameRequired: `Dateigruppenname ist erforderlich`,
        nameTooLong: `Dateigruppenname darf maximal 256 Zeichen lang sein`,
        createFailed: `Fehler beim Erstellen der Dateigruppe`,
        cancel: `Abbrechen`,
        create: `Erstellen`,
        creating: `Wird erstellt...`
    },
    jobsProgress: {
        title: `Jobs Fortschritt`,
        inProgress: `In Bearbeitung`,
        created: `Erstellt`,
        failed: `Fehlgeschlagen`
    },
    common: {
        files: {
            delete: (fileCount: number) => fileCount === 1 ? `Datei löschen` : `${fileCount} Dateien löschen`
        }
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
    jobList: {
        columns: {
            name: `Name`,
            status: `Status`,
            app: `App`,
            created: `Erstellt`,
            modified: `Geändert`
        }
    }
};

export default translation;
