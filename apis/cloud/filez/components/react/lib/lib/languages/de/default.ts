import baseDe from "@my-own-web-services/react-components/lib/languages/de/default";
import { CoreActionIds } from "@my-own-web-services/react-components/lib/mowsContext/coreActions";
import { FilezActionIds } from "@/lib/filezActions";
import type { Translation } from "@/lib/languages";

const translation: Translation = {
    ...baseDe,
    actions: {
        ...baseDe.actions,
        [CoreActionIds.OPEN_COMMAND_PALETTE]: `Befehlspalette öffnen`,
        [CoreActionIds.OPEN_KEYBOARD_SHORTCUTS]: `Tastenkombinationen öffnen`,
        [CoreActionIds.OPEN_LANGUAGE_SETTINGS]: `Spracheinstellungen öffnen`,
        [CoreActionIds.OPEN_THEME_SELECTOR]: `Theme-Auswahl öffnen`,
        [CoreActionIds.OPEN_PRIMARY_MENU]: `Hauptmenü öffnen`,
        [CoreActionIds.LOGIN]: `Anmelden`,
        [CoreActionIds.LOGOUT]: `Abmelden`,
        [CoreActionIds.OPEN_DEV_TOOLS]: `Entwicklerwerkzeuge öffnen`,
        [FilezActionIds.DELETE_FILES]: `Dateien löschen`,
        [FilezActionIds.DELETE_JOBS]: `Jobs löschen`,
        [FilezActionIds.CREATE_FILE_GROUP]: `Dateigruppe erstellen`
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
            delete: (fileCount: number) =>
                fileCount === 1 ? `Datei löschen` : `${fileCount} Dateien löschen`
        },
        jobs: {
            delete: (jobCount: number) =>
                jobCount === 1 ? `Job löschen` : `${jobCount} Jobs löschen`
        }
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
