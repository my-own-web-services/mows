import baseDe from "../../lib/lib/languages/de/default";
import type { Translation } from "../languages";
import { ExampleActionIds } from "../exampleActions";

const translation: Translation = {
    ...baseDe,
    actions: {
        ...baseDe.actions,
        [ExampleActionIds.GREET]: `Begrüßen`,
        [ExampleActionIds.COPY_TIMESTAMP]: `Aktuellen Zeitstempel kopieren`
    },
    example: {
        pageTitle: `MOWS-Komponenten — Beispiel`,
        pageSubtitle: `Öffne das Menü oben rechts, um Design, Sprache zu ändern oder dich anzumelden.`,
        menuHint: `Menü oben rechts`,
        themeAndLanguageCard: {
            title: `Design & Sprache`,
            description: `Das PrimaryMenu oben rechts ist mit dem MowsProvider verbunden. Der Zustand wird im localStorage unter dem storagePrefix gespeichert.`,
            themeBadge: `Design`,
            langBadge: `Sprache`,
            rightClickHint: `Rechtsklicke auf diese Karte, um das globale Kontextmenü zu öffnen (Aktionen mit Scope „exampleCard“).`
        },
        actionManagerCard: {
            title: `Aktions-Manager`,
            description: `Kernaktionen programmatisch oder per Tastenkombination auslösen.`,
            openCommandPalette: `Befehlspalette öffnen`,
            editKeyboardShortcuts: `Tastenkombinationen bearbeiten`,
            themeModal: `Design-Dialog`,
            languageModal: `Sprach-Dialog`
        },
        greetAlert: `Hallo aus der Beispielkarte!`,
        sidebar: {
            groups: {
                atoms: `Atome`,
                dateAndTime: `Datum & Uhrzeit`,
                actionsAndShortcuts: `Aktionen & Tastenkürzel`,
                settings: `Einstellungen`,
                lists: `Listen`,
                uiPrimitives: `UI-Primitive`
            },
            searchPlaceholder: `Komponenten suchen…`,
            searchAriaLabel: `Komponenten suchen`,
            searchClearAriaLabel: `Suche zurücksetzen`,
            noMatches: `Keine Komponenten passen zur Suche.`
        },
        ui: {
            button: {
                description: `Varianten und Größen der Basis-Schaltfläche.`,
                iconButtonAriaLabel: `Einstellungen`,
                disabledLabel: `deaktiviert`
            },
            badge: {
                description: `Inline-Status-Abzeichen.`
            },
            card: {
                description: `Container mit Header-, Inhalts- und Footer-Slots.`,
                title: `Karten-Titel`,
                descriptionText: `Kurzer ergänzender Text.`,
                body: `Karten gruppieren zusammengehörige Inhalte und Aktionen.`,
                confirm: `Bestätigen`,
                cancel: `Abbrechen`
            },
            input: {
                description: `Einfache Texteingabefelder in den gängigen Modi.`,
                text: `Text`,
                password: `Passwort`,
                disabled: `Deaktiviert`,
                placeholder: `Etwas eingeben…`,
                disabledValue: `schreibgeschützter Wert`
            },
            textarea: {
                description: `Mehrzeilige Texteingabe.`,
                placeholder: `Eine längere Nachricht schreiben…`,
                disabledValue: `deaktiviertes Textfeld`
            },
            label: {
                description: `Formular-Label, klickbar um das zugehörige Feld zu fokussieren.`,
                text: `Bedingungen akzeptieren`
            },
            checkbox: {
                description: `Checkbox-Primitiv mit Drei-Zustand-Unterstützung.`,
                checked: `Aktiv`,
                unchecked: `Inaktiv`,
                disabled: `Deaktiviert`
            },
            switch: {
                description: `Ein/Aus-Umschalter.`,
                on: `An`,
                off: `Aus`,
                disabled: `Deaktiviert`
            },
            select: {
                description: `Einfachauswahl-Dropdown.`,
                placeholder: `Eine Frucht wählen`,
                apple: `Apfel`,
                banana: `Banane`,
                cherry: `Kirsche`
            },
            radioGroup: {
                description: `Einfachauswahl-Gruppe von Optionsfeldern.`,
                apple: `Apfel`,
                banana: `Banane`,
                cherry: `Kirsche`
            },
            slider: {
                description: `Einzel- und Bereichsschieberegler.`
            },
            progress: {
                description: `Linearer Fortschrittsindikator.`
            },
            tabs: {
                description: `Wechsel zwischen Geschwister-Paneelen.`,
                account: `Konto`,
                password: `Passwort`,
                notifications: `Benachrichtigungen`,
                accountBody: `Aktualisiere deine Kontodaten.`,
                passwordBody: `Ändere dein Passwort.`,
                notificationsBody: `Benachrichtigungseinstellungen verwalten.`
            },
            dialog: {
                description: `Modaler Dialog mit Fokus-Falle und Overlay.`,
                open: `Dialog öffnen`,
                title: `Bist du sicher?`,
                descriptionText: `Diese Aktion kann nicht rückgängig gemacht werden.`,
                confirm: `Bestätigen`,
                cancel: `Abbrechen`
            },
            popover: {
                description: `Schwebendes Panel, an einen Trigger gebunden.`,
                open: `Popover öffnen`,
                body: `Popovers sind nicht modal — Klicks außerhalb schließen sie.`
            },
            hoverCard: {
                description: `Reiche Vorschau beim Hover, ideal für Benutzer-Erwähnungen.`,
                handle: `mows`,
                name: `MOWS Demo`,
                bio: `Ein einfacher Beispielnutzer, der beim Hover über den Link angezeigt wird.`
            },
            dropdownMenu: {
                description: `Aktions-Menü an einer Trigger-Schaltfläche.`,
                open: `Menü öffnen`,
                label: `Konto`,
                profile: `Profil`,
                settings: `Einstellungen`,
                bookmarks: `Lesezeichen`
            },
            contextMenu: {
                description: `Rechtsklick-Menü, das an seinen Triggerbereich gebunden ist.`,
                rightClick: `hier rechtsklicken`,
                action1: `Als gelesen markieren`,
                action2: `Antworten`,
                action3: `Löschen`
            },
            skeleton: {
                description: `Animierter Platzhalter während Inhalte laden.`
            },
            scrollArea: {
                description: `Container mit eigens gestylten Scrollbalken.`,
                itemPrefix: `Eintrag`
            },
            resizable: {
                description: `Vom Nutzer per Ziehen veränderbare geteilte Paneele.`,
                panel: `Panel`
            },
            sonner: {
                description: `Toast-Benachrichtigungen via sonner.`,
                show: `Toast anzeigen`,
                showSuccess: `Erfolg anzeigen`,
                showError: `Fehler anzeigen`,
                defaultMsg: `Nur eine Benachrichtigung.`,
                successMsg: `Erfolgreich gespeichert.`,
                errorMsg: `Etwas ist schiefgelaufen.`
            },
            inputGroup: {
                description: `Eingabefeld mit vorangestelltem Icon oder Addon.`,
                searchPlaceholder: `Suchen…`,
                usernamePlaceholder: `Benutzername`,
                emailPlaceholder: `du@beispiel.de`
            },
            calendar: {
                description: `Einzeldatum-Kalender-Primitiv.`,
                empty: `–`
            }
        },
        common: {
            selected: `ausgewählt`,
            value: `Wert`,
            tz: `Zeitzone`,
            empty: `–`,
            popoverTrigger: `Popover-Trigger`,
            standalone: `Eigenständig`
        },
        demos: {
            actionDisplay: {
                description: `Zeigt das Symbol, die Beschriftung und das Tastenkürzel einer Aktion an.`,
                notRegistered: `Aktion nicht registriert`
            },
            avatar: {
                description: `Runder Avatar mit Anfangsbuchstaben.`
            },
            buttonSelect: {
                description: `Schaltflächengruppe mit Einfachauswahl.`,
                grid: `Raster`,
                list: `Liste`,
                table: `Tabelle`
            },
            codeThemePicker: {
                description: `Wählt das Syntax-Highlighting-Design für den CodeViewer aus.`
            },
            codeViewer: {
                description: `Schreibgeschützter, Monaco-basierter Code-Viewer mit Syntax-Highlighting.`
            },
            commandPalette: {
                description: `Global eingebunden. Öffnen über die Aktion unten oder das Tastenkürzel.`,
                openButton: `Befehlspalette öffnen`
            },
            copyValueButton: {
                description: `Klicke, um einen Wert in die Zwischenablage zu kopieren.`,
                tokenLabel: `Token kopieren`,
                timeLabel: `Aktuelle Zeit kopieren`
            },
            dateTime: {
                description: `Anzeige eines Zeitstempels in der lokalen Sprache.`,
                nowLabel: `Jetzt`,
                naiveLabel: `Ohne Zeitzone`,
                utcLabel: `UTC`
            },
            dateTimePicker: {
                description: `Datums- und Uhrzeitauswahl.`
            },
            timePicker: {
                description: `Auswahl von Stunden, Minuten und Sekunden.`
            },
            timezoneSelector: {
                description: `Durchsuchbare IANA-Zeitzonenauswahl.`
            },
            dateTimeRangePicker: {
                description: `Auswahl eines Start-/Endzeitpunkts (Datum und Uhrzeit).`
            },
            globalContextMenu: {
                description: `Rechtsklicke auf einen Bereich mit passendem data-actionscope, um das globale Kontextmenü zu öffnen. Ein Rechtsklick auf einen Eintrag führt ihn aus.`,
                rightClickHere: `hier rechtsklicken`
            },
            keyboardShortcutEditor: {
                description: `Listet alle registrierten Aktionen auf und erlaubt das Neubelegen der Tastenkürzel.`
            },
            keyComboDisplay: {
                description: `Stellt eine Tastenkombination als gestylte Tastenkappen dar.`
            },
            languagePicker: {
                description: `Trigger (links) und eigenständige Variante (rechts).`
            },
            modalHandler: {
                description: `Global eingebunden — öffnet den Dialog, den die aktive Aktion anfordert.`,
                themeButton: `Design-Dialog öffnen`,
                languageButton: `Sprach-Dialog öffnen`,
                shortcutsButton: `Tastenkürzel-Dialog öffnen`
            },
            optionPicker: {
                description: `Popover mit einer Liste umschaltbarer Optionen.`,
                compact: `Kompakte Zeilen`,
                wrap: `Text umbrechen`,
                lineNumbers: `Zeilennummern`
            },
            settingsPanel: {
                description: `Gebündeltes Panel mit Design-, Sprach-, Code-Design- und Editor-Einstellungen.`
            },
            primaryMenu: {
                description: `Global oben rechts eingebunden — klicke den Avatar, um es zu öffnen.`,
                topRightHint: `siehe oben rechts`
            },
            themePicker: {
                description: `Trigger (links) und eigenständige Variante (rechts).`
            },
            loggingConfig: {
                description: `Datei-spezifische Log-Level-Überschreibungen, im localStorage gespeichert.`
            },
            resourceList: {
                description: `ResourceList benötigt eine paginierte Datenquelle — ein vollständiges Beispiel findet sich im filez-Frontend.`,
                note: `Keine eigenständige Demo: Diese Komponente rendert große, unendlich scrollende Listen, die von einer serverseitigen getResourcesList-Funktion gespeist werden.`
            },
            searchInput: {
                description: `Generisches Suchfeld mit führendem Symbol und Zurücksetzen-Schaltfläche. Wird in der Seitenleiste zum Filtern der Komponenten verwendet.`,
                placeholder: `Suchen…`,
                valueLabel: `Wert`
            }
        }
    }
};

export default translation;
