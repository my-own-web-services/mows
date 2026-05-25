import type { BaseTranslation } from "../../languages";
import { CoreActionIds } from "../../mowsContext/coreActions";

const translation: BaseTranslation = {
    videoViewer: {
        play: `Abspielen`,
        pause: `Pause`,
        mute: `Stummschalten`,
        unmute: `Stummschaltung aufheben`,
        volume: `Lautstärke`,
        seek: `Suchen`,
        seekTo: `Springe zu`,
        quality: `Qualität`,
        qualityAuto: `Auto`,
        captions: `Untertitel`,
        captionsOff: `Aus`,
        playbackRate: `Wiedergabegeschwindigkeit`,
        pictureInPicture: `Bild-in-Bild`,
        fullscreen: `Vollbild`,
        exitFullscreen: `Vollbild verlassen`,
        errorTitle: `Wiedergabe fehlgeschlagen`,
        errorRetry: `Erneut versuchen`,
        loading: `Lädt…`
    },
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
    mapStylePicker: {
        title: `Kartenstil-Auswahl`,
        label: `Kartenstil`,
        selectMapStyle: `Kartenstil auswählen`,
        noMapStyleFound: `Kein Kartenstil gefunden`
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
            codeEditor: `Code-Editor`,
            notifications: `Benachrichtigungen`,
            map: `Karte`
        },
        labels: {
            theme: `Design`,
            language: `Sprache`,
            codeTheme: `Code-Design`,
            showWhitespace: `Leerzeichen anzeigen`,
            wrap: `Lange Zeilen umbrechen`,
            showLineNumbers: `Zeilennummern anzeigen`,
            bracketPairColorization: `Klammerpaare einfärben`,
            toastPosition: `Toast-Position`,
            mapStyle: `Kartenstil`
        },
        toastPositions: {
            topLeft: `Oben links`,
            topCenter: `Oben mittig`,
            topRight: `Oben rechts`,
            bottomLeft: `Unten links`,
            bottomCenter: `Unten mittig`,
            bottomRight: `Unten rechts`
        }
    },
    keyboardShortcuts: {
        label: `Tastenkombinationen`,
        title: `Tastenkombinationen`,
        resetAll: `Alle zurücksetzen`,
        edit: `Bearbeiten`,
        reset: `Zurücksetzen`,
        delete: `Löschen`,
        searchPlaceholder: `Aktionen suchen...`,
        searchAriaLabel: `Aktionen suchen`,
        actionNotFound: `Aktion nicht gefunden`,
        noActionsFound: `Keine Aktionen gefunden, die zu "{searchQuery}" passen`,
        addHotkeyButton: `Tastenkombination hinzufügen`,
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
    consoleManager: {
        split: `Teilen`,
        kill: `Beenden`,
        rename: `Umbenennen`,
        splitTerminal: `Terminal teilen`,
        killTerminal: `Terminal beenden`
    },
    dateTimePicker: {
        ariaLabel: `Datum und Uhrzeit`,
        timezoneLabel: `Zeitzone`
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
        reload: `Neu laden`,
        crossListDoesNotAcceptDrops: `nimmt keine Drops an`
    },
    pageIndex: {
        heading: `Auf dieser Seite`,
        ariaLabel: `Auf dieser Seite`
    },
    expandableCode: {
        expand: `Ausklappen`,
        collapse: `Einklappen`
    },
    keyComboRecorder: {
        heading: `Tastenkombinationen aufzeichnen`,
        hint: `Klicke auf „Aufzeichnung starten“ und drücke dann beliebige Kombinationen auf deiner Tastatur — jeder Tastendruck wird der Liste unten angehängt. Auch eine allein losgelassene Modifikator-Taste (z. B. nur Umschalt) wird erfasst. Klicke „Aufzeichnung stoppen“, wenn du fertig bist.`,
        start: `Aufzeichnung starten`,
        stop: `Aufzeichnung stoppen`,
        clear: `Leeren`,
        listening: `Lausche — drücke eine beliebige Tastenkombination…`
    },
    keys: {
        ctrl: `Strg`,
        alt: `Alt`,
        altgr: `Alt Gr`,
        fn: `Fn`,
        shift: `Umschalt`,
        meta: `Win`,
        enter: `Eingabe`,
        esc: `Esc`,
        tab: `Tab`,
        space: `Leertaste`,
        backspace: `Rücktaste`,
        del: `Entf`,
        insert: `Einfg`,
        home: `Pos1`,
        end: `Ende`,
        pageUp: `Bild`,
        pageDown: `Bild`,
        pause: `Pause`,
        scrollLock: `Rollen`,
        numLock: `Num`,
        printScreen: `Druck`
    }
};

export default translation;
