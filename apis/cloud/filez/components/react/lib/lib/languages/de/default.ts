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
    userGroupCreate: {
        createUserGroup: `Benutzergruppe erstellen`,
        title: `Neue Benutzergruppe erstellen`,
        description: `Erstellt eine private, nur per Einladung zugängliche Gruppe. Sichtbarkeit und Beitrittsrichtlinie können in den Einstellungen angepasst werden.`,
        nameLabel: `Name der Benutzergruppe`,
        namePlaceholder: `Name der Benutzergruppe eingeben`,
        nameRequired: `Der Gruppenname ist erforderlich`,
        nameTooLong: `Der Gruppenname darf maximal 256 Zeichen lang sein`,
        createFailed: `Fehler beim Erstellen der Benutzergruppe`,
        cancel: `Abbrechen`,
        create: `Erstellen`,
        creating: `Wird erstellt...`
    },
    userGroupSettings: {
        title: `Einstellungen der Benutzergruppe`,
        nameLabel: `Name`,
        nameRequired: `Name ist erforderlich`,
        nameTooLong: `Name darf maximal 256 Zeichen lang sein`,
        descriptionLabel: `Beschreibung`,
        descriptionPlaceholder: `Optional — wird im Verzeichnis angezeigt`,
        descriptionTooLong: `Beschreibung darf maximal 1024 Zeichen lang sein`,
        visibilityLabel: `Sichtbarkeit`,
        joinPolicyLabel: `Beitrittsrichtlinie`,
        visibility: {
            private: `Privat — nur Eigentümer und Mitglieder sehen diese Gruppe`,
            listedRestricted: `Gelistet — alle Servermitglieder sehen sie, nur Eigentümer fügt hinzu`,
            public: `Öffentlich — jeder sieht, dass diese Gruppe existiert`
        },
        joinPolicy: {
            inviteOnly: `Nur Einladung — Eigentümer fügt Mitglieder direkt hinzu`,
            requestToJoin: `Beitrittsantrag — Eigentümer genehmigt`,
            openJoin: `Offener Beitritt — jedes Servermitglied kann beitreten`
        },
        updateFailed: `Fehler beim Aktualisieren der Benutzergruppe`,
        cancel: `Abbrechen`,
        save: `Speichern`,
        saving: `Wird gespeichert...`
    },
    userGroupPicker: {
        title: `Benutzergruppen-Auswahl`,
        selectUserGroup: `Benutzergruppe auswählen`,
        noUserGroupFound: `Keine Benutzergruppe gefunden`,
        loading: `Lade Benutzergruppen...`,
        loadFailed: `Fehler beim Laden der Benutzergruppen`
    },
    userGroupList: {
        loading: `Lade Benutzergruppen...`,
        empty: `Keine Benutzergruppen für diesen Filter`,
        open: `Öffnen`,
        loadFailed: `Fehler beim Laden der Benutzergruppen`,
        totalCount: (totalCount: number) =>
            totalCount === 1 ? `1 Gruppe` : `${totalCount} Gruppen`,
        filters: {
            owned: `Eigene`,
            member: `Beigetreten`,
            invited: `Eingeladen`,
            requested: `Angefragt`,
            serverListed: `Server`,
            public: `Öffentlich`
        },
        visibility: {
            private: `Privat`,
            listedRestricted: `Gelistet`,
            public: `Öffentlich`
        },
        joinPolicy: {
            inviteOnly: `Nur Einladung`,
            requestToJoin: `Beitrittsantrag`,
            openJoin: `Offener Beitritt`
        }
    },
    userGroupDetail: {
        loading: `Wird geladen...`,
        working: `Wird ausgeführt...`,
        noMembers: `Noch keine Mitglieder`,
        noInvitations: `Keine ausstehenden Einladungen`,
        noJoinRequests: `Keine ausstehenden Beitrittsanfragen`,
        ownerBadge: `Eigentümer`,
        removeMember: `Entfernen`,
        invite: `Einladen`,
        inviteUserIdLabel: `Benutzer-ID`,
        inviteUserIdPlaceholder: `00000000-0000-0000-0000-000000000000`,
        inviteMessageLabel: `Nachricht (optional)`,
        join: `Beitreten`,
        requestJoin: `Beitritt anfragen`,
        leave: `Verlassen`,
        deleteGroup: `Gruppe löschen`,
        approve: `Annehmen`,
        reject: `Ablehnen`,
        invitedOn: (when: string) => `Eingeladen am ${when}`,
        requestedOn: (when: string) => `Angefragt am ${when}`,
        groupIdPrefix: `Gruppen-ID:`,
        userIdPrefix: `Benutzer-ID:`,
        errors: {
            loadMembers: `Fehler beim Laden der Mitglieder`,
            loadInvitations: `Fehler beim Laden der Einladungen`,
            loadJoinRequests: `Fehler beim Laden der Beitrittsanfragen`,
            invite: `Fehler beim Einladen des Benutzers`,
            approve: `Fehler beim Annehmen der Anfrage`,
            reject: `Fehler beim Ablehnen der Anfrage`,
            removeMember: `Fehler beim Entfernen des Mitglieds`,
            leave: `Fehler beim Verlassen der Gruppe`,
            deleteGroup: `Fehler beim Löschen der Gruppe`,
            requestJoin: `Fehler beim Anfragen des Beitritts`
        },
        tabs: {
            members: `Mitglieder`,
            invitations: `Einladungen`,
            requests: `Beitrittsanfragen`
        }
    },
    userGroupPendingDashboard: {
        loading: `Wird geladen...`,
        invitations: `Einladungen`,
        requests: `Meine Anfragen`,
        noInvitations: `Keine ausstehenden Einladungen`,
        noRequests: `Keine ausstehenden Anfragen`,
        accept: `Annehmen`,
        decline: `Ablehnen`,
        working: `Wird ausgeführt...`,
        invitedOn: (when: string) => `Eingeladen am ${when}`,
        requestedOn: (when: string) => `Angefragt am ${when}`,
        groupIdPrefix: `Gruppen-ID:`,
        errors: {
            load: `Fehler beim Laden ausstehender Einträge`,
            accept: `Fehler beim Annehmen der Einladung`,
            decline: `Fehler beim Ablehnen der Einladung`
        }
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
