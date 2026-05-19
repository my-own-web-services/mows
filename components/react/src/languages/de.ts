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
                actions: `Aktionen & Tastenkürzel`,
                appShell: `App-Struktur`,
                code: `Code`,
                console: `Konsole`,
                dateTime: `Datum & Uhrzeit`,
                files: `Dateien`,
                identity: `Identität`,
                input: `Eingabe`,
                list: `Listen`,
                navigation: `Navigation`,
                settings: `Einstellungen`,
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
        examples: {
            _harness: {
                codeTab: `Code`,
                noStateReported: `Dieses Beispiel meldet keinen Zustand.`
            },
            steps: {
                horizontal: {
                    title: `Horizontale Schrittanzeige`,
                    description: `Standardmäßige horizontale Anordnung. Der Status wird aus dem kontrollierten „current“-Index abgeleitet.`
                },
                vertical: {
                    title: `Vertikale Schrittanzeige`,
                    description: `Schritte vertikal stapeln, mit der Verbindungslinie zwischen den Indikatoren.`
                },
                statusOverride: {
                    title: `Status pro Schritt überschreiben`,
                    description: `Übergib „status“ an einen einzelnen <Step>, um seine Darstellung unabhängig vom abgeleiteten Zustand zu erzwingen.`
                },
                wizard: {
                    title: `Assistent (Vorschau + Inhalt)`,
                    description: `<Steps> mit Inhaltsbereich und Zurück/Weiter-Schaltflächen für einen realen Ablauf kombinieren.`
                },
                selection: {
                    title: `Auswahlmodus`,
                    description: `mode="selection" macht aus der Schrittanzeige eine Schrittauswahl: jeder Kreis zeigt seine Nummer, der aktive Schritt ist mit der Primärfarbe gefüllt, und es gibt kein Konzept von „abgeschlossen“.`
                },
                disabled: {
                    title: `Deaktiviert`,
                    description: `Die gesamte Schrittanzeige im deaktivierten Zustand — gedämpft und nicht interaktiv — mittels eines Containers mit aria-disabled und pointer-events-none.`
                },
                icons: {
                    title: `Icons`,
                    description: `Step-Titel akzeptieren beliebige ReactNode-Werte, sodass jedem Label ein Icon vorangestellt werden kann, ohne das <Steps>-Primitiv anzupassen.`
                },
                rtl: {
                    title: `RTL`,
                    description: `<Steps> in dir="rtl" einzuschließen dreht das Layout für rechtsläufige Schriften. Horizontale und vertikale Ausrichtung folgen beide.`
                },
                doc: {
                    installation: {
                        title: `Installation`,
                        commandTab: `Befehl`,
                        manualTab: `Manuell`,
                        manualStep1: `Installiere die folgenden Abhängigkeiten:`,
                        manualStep2: `Kopiere den folgenden Code in dein Projekt.`,
                        manualStep3: `Passe die Importpfade an dein Projekt an.`
                    },
                    usage: {
                        title: `Verwendung`,
                        body: `Importiere <Steps> und <Step> aus dem Paket und rendere sie mit einer kontrollierten „current“-Prop. <Step> liest Ausrichtung und current über Context aus dem umgebenden <Steps>; die Kinder müssen daher direkte <Step>-Elemente sein.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<Steps> ist ein schlankes Layout, das Context an seine Kinder weiterleitet. Jeder <Step> rendert einen Indikatorkreis und ein Label. Der Status pro Schritt (completed / current / upcoming) wird aus dem Index relativ zu „current“ abgeleitet, lässt sich aber per „status“-Prop überschreiben, etwa für Fehler- oder Übersprungszustände.`
                    },
                    examples: {
                        title: `Beispiele`,
                        line: {
                            title: `Linie`,
                            description: `Das voreingestellte horizontale Layout: ein nummerierter Indikator pro Schritt, verbunden durch eine Linie.`
                        },
                        vertical: {
                            title: `Vertikal`,
                            description: `Schritte vertikal stapeln, mit der Verbindungslinie zwischen den Indikatoren.`
                        },
                        disabled: {
                            title: `Deaktiviert`,
                            description: `Die Schrittanzeige vollständig deaktiviert dargestellt — gedämpft und nicht interaktiv.`
                        },
                        icons: {
                            title: `Icons`,
                            description: `Ein ReactNode-Titel ermöglicht es, jedem Step-Label ein Icon voranzustellen.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Steps> verhalten soll, jeweils mit Verweis auf den Test, der das Verhalten absichert. Die Pfade verweisen auf lib/components/ui/steps.test.tsx in diesem Paket.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            derivesStatuses: `Index < current ergibt completed, == current ergibt current, > current ergibt upcoming.`,
                            ariaCurrent: `Der Schritt bei „current“ trägt aria-current="step".`,
                            rendersTitleDescription: `<Step> rendert Titel und optionale Beschreibung wie angegeben.`,
                            orientationAttr: `Die <ol> spiegelt die Ausrichtung über das Attribut aria-orientation wider.`,
                            statusOverride: `Ein „status“-Prop auf einem <Step> überschreibt den aus dem Index abgeleiteten Status.`,
                            selectionNoCompleted: `Im mode="selection" werden Indizes vor „current“ niemals als completed markiert.`,
                            selectionShowsNumbers: `Im mode="selection" zeigt jeder Indikator seine Schrittnummer; keine Check-Icons.`,
                            throwsOutsideSteps: `<Step> außerhalb von <Steps> zu rendern wirft einen aussagekräftigen Fehler.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Die Schrittanzeige erbt die Richtung von ihrem DOM-Vorfahren: ein umgebendes dir="rtl" kehrt Indikatorreihenfolge, Label-Ausrichtung und Verbindungslinien um — ohne Prop-Änderungen.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Steps> und <Step> akzeptieren.`
                    }
                }
            },
            pageIndex: {
                default: {
                    title: `Standard`,
                    description: `Eine „Auf dieser Seite“-Leiste neben einer Liste verankerter Abschnitte. Ein Klick scrollt sanft zum passenden Abschnitt und aktualisiert den URL-Hash.`
                },
                nested: {
                    title: `Verschachtelt`,
                    description: `Übergib <PageIndexItem>.children, um eine Baumstruktur verankerter Abschnitte zu rendern. Die Aktiv-Linie bleibt unabhängig von der Tiefe ganz links.`
                },
                doc: {
                    installation: {
                        title: `Installation`,
                        commandTab: `Befehl`,
                        manualTab: `Manuell`,
                        manualStep1: `Installiere die folgenden Abhängigkeiten:`,
                        manualStep2: `Kopiere den folgenden Code in dein Projekt.`,
                        manualStep3: `Passe die Importpfade an dein Projekt an.`
                    },
                    usage: {
                        title: `Verwendung`,
                        body: `Importiere <PageIndex> aus dem Paket und übergib ein Array von { id, label }-Einträgen. Jede id muss zu einer DOM-Element-id auf derselben Seite passen.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<PageIndex> ist ein Navigations-Primitiv — die verankerten Elemente werden vom Konsumenten gerendert. Einträge können children tragen, um eine eingerückte Unterliste zu rendern; die Verschachtelung ist nur Darstellung, der Scrollspy behandelt jede id gleich.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Flache Liste verankerter Abschnitte mit der Leiste rechts.`
                        },
                        nested: {
                            title: `Verschachtelt`,
                            description: `Einträge mit children werden als eingerückte Unterliste unter ihrem Elternteil gerendert.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <PageIndex> verhalten soll, jeweils mit Verweis auf den Test, der das Verhalten absichert.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            pushesHashOnClick: `Ein Klick auf einen Eintrag schreibt #<id> per history.replaceState in die URL.`,
                            smoothOnClick: `Klick-getriggertes Scrollen verwendet behavior: "smooth".`,
                            instantOnLoad: `Anfängliches Hash-Scrollen verwendet behavior: "auto" — die Seite springt ohne Animation zum Ziel.`,
                            immediateActiveOnClick: `Der angeklickte Eintrag wird sofort aktiv, auch wenn die Seite bereits dort ist.`,
                            holdsActiveDuringScroll: `Der angeklickte Eintrag bleibt während der Animation aktiv — Zwischen-Scroll-Ereignisse kippen die Markierung nicht.`,
                            nestedRenders: `Einträge mit children rendern einen Link für jedes Blatt UND den Elternteil.`,
                            nestedScrollsToChild: `Ein Klick auf ein verschachteltes Kind scrollt und schreibt seine Hash — nicht die des Elternteils.`,
                            emptyRendersNothing: `Rendert nichts, wenn items leer ist.`,
                            missingIdSkipsHash: `Fehlt die Ziel-id im DOM, wird die Hash NICHT aktualisiert.`,
                            translationFallback: `Überschrift und aria-label fallen auf Englisch zurück, wenn kein <MowsProvider> eingehängt ist.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Das Leistenlayout ist richtungsneutral — wickle es in dir="rtl" und die Einrückung kehrt sich für die verschachtelten Unterlisten um.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <PageIndex> akzeptiert.`
                    }
                }
            },
            fileIcon: {
                default: {
                    title: `Gängige Dateitypen`,
                    description: `Wählt anhand des Dateinamens das passende Material-Datei-Icon. Zuerst wird nach exaktem Dateinamen gesucht (z. B. Dockerfile, .gitignore), dann nach Dateiendung; sonst greift das generische Datei-Icon.`
                },
                sizes: {
                    title: `Größen`,
                    description: `Dasselbe Icon in mehreren Pixelgrößen. Die size-Property bestimmt Breite und Höhe; das SVG skaliert ohne Qualitätsverlust.`
                },
                fallback: {
                    title: `Unbekannte Endungen`,
                    description: `Findet der Upstream-Resolver keine spezifische Zuordnung, liefert er das generische File-Icon zurück. Nur wenn auch das SVG selbst nicht laden kann, zeigt FileIcon zusätzlich das lucide-File-Glyph als Fallback.`
                }
            },
            codeSnippet: {
                doc: {
                    installation: {
                        title: `Installation`,
                        commandTab: `Befehl`,
                        manualTab: `Manuell`,
                        manualStep1: `Installiere die folgenden Abhängigkeiten:`,
                        manualStep2: `Kopiere den folgenden Code in dein Projekt.`,
                        manualStep3: `Passe die Importpfade an dein Projekt an.`
                    },
                    usage: {
                        title: `Verwendung`,
                        body: `Importiere <CodeSnippet> aus dem Paket und übergib den Code-String plus eine optionale Sprache. Wähle mode="block" für eigenständige Snippets, mode="inline" für Chips innerhalb eines Satzes.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<CodeSnippet> ist ein in sich geschlossenes Primitiv. Monacos colorize-API läuft in einem verzögerten React.lazy-Chunk, sodass Konsumenten, die kein Snippet rendern, das Monaco-Bundle nicht laden müssen.`
                    },
                    examples: {
                        title: `Beispiele`,
                        block: {
                            title: `Mehrzeiliger Block`,
                            description: `Wird per Monaco mit dem aktuellen Code-Theme tokenisiert.`
                        },
                        inline: {
                            title: `Inline im Fließtext`,
                            description: `Ein Chip, der innerhalb eines Satzes steht — Zeilenumbrüche werden zusammengezogen.`
                        },
                        languages: {
                            title: `Sprachen`,
                            description: `Dieselbe Komponente mit unterschiedlichen Monaco-Sprach-IDs.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <CodeSnippet> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            blockFallback: `Im Block-Modus wird ein <pre>-Fallback mit dem rohen Code gerendert, während Monaco lädt.`,
                            inlineFallback: `Im Inline-Modus wird ein <code>-Fallback mit dem rohen Code gerendert, während Monaco lädt.`,
                            defaultMode: `Ohne mode-Prop wird der Block-Modus verwendet.`,
                            forwardsClassName: `className- und style-Props werden an das gerenderte Wrapper-Element weitergereicht.`,
                            preservesMultiline: `Der Block-Fallback bewahrt mehrzeiligen Code wortgetreu.`,
                            rendersWithoutProvider: `Snippets rendern ohne <MowsProvider> — das Standard-Code-Theme greift.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Code ist richtungsneutral. Ein umgebendes dir="rtl" lässt die Quellreihenfolge unverändert; nur der Fließtext-Fluss kehrt sich um.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <CodeSnippet> akzeptiert.`
                    }
                },
                block: {
                    title: `Mehrzeiliger Block`,
                    description: `Tokenisierung über Monacos colorize-API, gestylt mit dem aktuellen Code-Theme — ganz ohne Editor-Mount. Geeignet für kurze, illustrative Snippets, die einen eigenen visuellen Block bekommen sollen.`
                },
                inline: {
                    title: `Inline im Fließtext`,
                    description: `Der Inline-Modus rendert einen gestylten <code>-artigen Chip mitten im Satz. Zeilenumbrüche werden zusammengefasst, sodass das Snippet immer einzeilig bleibt.`
                },
                languages: {
                    title: `Sprachen`,
                    description: `Dieselbe Komponente, verschiedene Monaco-Sprach-IDs. plaintext liefert reinen Monospace-Text ohne Tokenfarben.`
                }
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
                timeLabel: `Aktuelle Zeit kopieren`,
                toastLabel: `Mit Toast kopieren`,
                toastMessage: `Token in die Zwischenablage kopiert`
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
            fileViewer: {
                description: `Generische Dateivorschau. Wählt anhand des MIME-Typs aus; image/* nutzt den ImageViewer (bzw. Image360Viewer wenn is360 gesetzt ist). Andere Typen zeigen den Dateinamen.`,
                hint: `Beim Laden wird ein mitgeliefertes Beispielbild angezeigt. Eine beliebige URL eingeben, um es zu ersetzen.`,
                urlPlaceholder: `https://example.com/foto.jpg`,
                namePlaceholder: `foto.jpg`,
                mimeTypePlaceholder: `image/jpeg`,
                empty: `URL eingeben, um eine Vorschau zu sehen.`,
                loadSample: `Beispiel laden`,
                clear: `Leeren`,
                sampleName: `landschaft.webp`,
                photoBy: `Foto`,
                sourceLink: `Quelle`
            },
            image360Viewer: {
                description: `Equirektangulärer 360°-Panorama-Viewer auf Basis von Photo Sphere Viewer (three.js). Wird erst beim ersten Rendern nachgeladen.`,
                hint: `Beim Laden wird ein mitgeliefertes Beispiel-Panorama angezeigt. Ziehen zum Umsehen, Scrollen zum Zoomen. Eine equirektanguläre URL (Verhältnis 2:1) einfügen, um eigene Inhalte zu laden.`,
                urlPlaceholder: `https://example.com/panorama.jpg`,
                empty: `URL zu einem equirektangulären Bild eingeben.`,
                loadSample: `Beispiel laden`,
                load: `Laden`,
                clear: `Leeren`,
                photoBy: `Foto`,
                sourceLink: `Quelle`
            },
            globalContextMenu: {
                description: `Rechtsklicke auf einen Bereich mit passendem data-actionscope, um das globale Kontextmenü zu öffnen. Ein Rechtsklick auf einen Eintrag führt ihn aus.`,
                rightClickHere: `hier rechtsklicken`
            },
            keyboardShortcutEditor: {
                description: `Listet alle registrierten Aktionen auf und erlaubt das Neubelegen der Tastenkürzel.`
            },
            keyComboDisplay: {
                description: `Stellt eine Tastenkombination als gestylte Tastenkappen dar. Zeigt immer die Win-/Linux-Variante; macOS-spezifische Glyphen (⌘, ⌃, ⌥) werden separat in der Legende darunter dokumentiert, damit Docs eine Zeile pro Shortcut und einen einzigen Legenden-Bereich zeigen können.`,
                combosHeading: `Häufige Kombinationen`,
                iconsHeading: `Alle Tasten mit Symbol`,
                textHeading: `Tasten mit Text (Windows / Linux)`,
                textHint: `Diese werden als aktive Übersetzung gerendert. Sprache oben rechts wechseln — sie aktualisieren sich.`,
                macDifferencesHeading: `macOS-Entsprechungen`,
                macDifferencesHint: `Auf einer Mac-Tastatur erscheinen die oben als Text gerenderten Tokens als Symbole. Jede Zeile fasst alle Aliase zusammen, die auf dasselbe Symbol abbilden.`
            },
            keyComboRecorder: {
                description: `Echte Tastatur-Eingaben erfassen und mit demselben Formatter, den der Rest der App nutzt, zu Combo-Strings konvertieren.`,
                heading: `Tastenkombinationen aufzeichnen`,
                hint: `"Aufzeichnung starten" klicken, dann beliebige Kombinationen drücken — jeder Tastendruck wird unten angehängt. Eine Modifikatortaste, die alleine wieder losgelassen wird (z. B. nur Umschalt), wird ebenfalls erfasst. "Aufzeichnung stoppen" beendet das Lauschen.`,
                start: `Aufzeichnung starten`,
                stop: `Aufzeichnung stoppen`,
                clear: `Leeren`,
                listening: `Höre zu — beliebige Tastenkombination drücken…`
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
            logView: {
                description: `Einfache Log-Ansicht: Zeilen rein, Zeilen werden gerendert. Autoscroll; nach oben scrollen pausiert das Autoscrolling. Optional Filter und Leeren-Button.`,
                hint: `"Zeile schicken" wiederholt klicken, um Beispiel-Serverausgabe anzuhängen. "Leeren" entleert die Ansicht über onClear.`,
                searchPlaceholder: `Filtern…`,
                empty: `Noch keine Log-Zeilen.`,
                pushLine: `Zeile schicken`
            },
            terminal: {
                description: `Interaktives Terminal auf Basis von xterm.js. Der xterm-Code liegt in einem Lazy-Chunk und wird erst geladen, wenn das erste Terminal eingehängt wird. Über das imperative Ref (write / writeln / clear / focus / fit) wird Serverausgabe eingespeist, onData leitet Tastatureingaben nach oben. Der onReady-Callback feuert, sobald der Lazy-Chunk geladen ist — ideal, um ein Begrüßungsbanner auszugeben.`,
                hint: `Die Demo verdrahtet eine kleine "Shell" — eine Zeile tippen und mit Enter abschicken, um sie zurückgespiegelt zu sehen. Die Begrüßung wird beim Mount via onReady ausgegeben.`,
                clear: `Leeren`
            },
            machineMonitor: {
                description: `VNC-Anzeige auf Basis von react-vnc / noVNC. Der noVNC-Client liegt in einem Lazy-Chunk und wird erst geladen, wenn der erste MachineMonitor eingehängt wird. Eine WebSocket-URL zu einer VNC-WebSocket-Brücke füttern und es verbindet automatisch.`,
                hint: `ws:// oder wss:// URL zu einer VNC-Brücke eintragen und auf Verbinden klicken. Ohne Server bleibt der Bildschirm getrennt — der Lazy-Chunk wird trotzdem nur beim ersten Mount geladen.`,
                urlPlaceholder: `ws://localhost:5900`,
                connect: `Verbinden`,
                disconnect: `Trennen`,
                sendCtrlAltDel: `Strg+Alt+Entf senden`,
                readOnly: `Nur lesen (passiv eingebettet)`,
                status: {
                    connected: `Verbunden`,
                    disconnected: `Getrennt`
                },
                loadingLabel: `VNC-Client wird geladen…`
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
