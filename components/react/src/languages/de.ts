import baseDe from "../../lib/lib/languages/de/default";
import type { Translation } from "../languages";
import { ExampleActionIds } from "../exampleActions";

const translation: Translation = {
    ...baseDe,
    actions: {
        ...baseDe.actions,
        [ExampleActionIds.GREET]: `Begrüßen`,
        [ExampleActionIds.COPY_TIMESTAMP]: `Aktuellen Zeitstempel kopieren`,
        [ExampleActionIds.SHARE]: `Teilen`,
        [ExampleActionIds.SHARE_COPY_LINK]: `Link kopieren`,
        [ExampleActionIds.SHARE_EMAIL]: `E-Mail`,
        [ExampleActionIds.SHARE_SLACK]: `Slack`,
        [ExampleActionIds.TRASH]: `In den Papierkorb`,
        [ExampleActionIds.DUPLICATE]: `Duplizieren`,
        [ExampleActionIds.REPO_DELETE]: `Löschen`
    },
    example: {
        pageTitle: `MOWS-Komponenten — Beispiel`,
        menuHint: `Menü oben rechts`,
        themeAndLanguageCard: {
            title: `Design & Sprache`,
            description: `Das PrimaryMenu oben rechts ist mit dem MowsProvider verbunden. Der Zustand wird im localStorage unter dem storagePrefix gespeichert.`,
            themeBadge: `Design`,
            languageBadge: `Sprache`,
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
                editor: `Editoren`,
                files: `Dateien`,
                identity: `Identität`,
                input: `Eingabe`,
                list: `Listen`,
                map: `Karte`,
                navigation: `Navigation`,
                settings: `Einstellungen`,
                uiPrimitives: `UI-Primitive`
            },
            searchPlaceholder: `Komponenten suchen…`,
            searchAriaLabel: `Komponenten suchen`,
            searchClearAriaLabel: `Suche zurücksetzen`,
            noMatches: `Keine Komponenten passen zur Suche.`,
            favorites: `Favoriten`,
            addToFavoritesAriaLabel: `Zu Favoriten hinzufügen`,
            removeFromFavoritesAriaLabel: `Aus Favoriten entfernen`,
            guidesLabel: `Anleitungen`,
            creatingAppsLabel: `Apps erstellen`
        },
        guides: {
            creatingApps: {
                title: `Apps erstellen`,
                placeholder: `Inhalt folgt — empfohlene Patterns, zu vermeidende Antipatterns und ein Seitenindex werden hier erscheinen.`,
                setup: {
                    title: `Setup`,
                    intro: `Jede MOWS-App startet aus demselben minimalen Gerüst. Verdrahte es einmal am Root, danach kann jede Komponente im Baum geteilten State über \`useMows()\` abrufen.`,
                    provider: {
                        title: `MowsProvider`,
                        body: `Wrappe deinen Root in \`<MowsProvider>\` mit einem \`storagePrefix\`, der für deine App eindeutig ist. Der Prefix umgrenzt alles, was wir in \`localStorage\` persistieren (Theme, Sprache, Favoriten, Hotkey-Overrides, kürzlich genutzte Actions, …), damit mehrere MOWS-Apps am selben Origin niemals den State der anderen überschreiben. Übergib \`oidc\` nur, wenn deine App selbst authentifiziert — lass es weg, wenn ein vorgelagerter Proxy bzw. ein Bearer-Token-API die Auth übernimmt.`
                    },
                    appShell: {
                        title: `App-Shell-Mounts`,
                        body: `Platziere \`<CommandPalette>\`, \`<ModalHandler>\`, \`<GlobalContextMenu>\` und \`<Toaster>\` jeweils einmal irgendwo innerhalb des Providers — typischerweise direkt neben dem Top-Level-\`<App />\`. Sie rendern nichts, solange sie nicht gerufen werden, aber \`useMows()\`, Action-Handler und Toast-Emitter werden still wirkungslos, sobald ein Mount fehlt. Das Auslassen eines dieser Mounts ist der häufigste Grund, warum ein Action- / Shortcut- / Toast-Aufruf scheinbar nichts tut — mounte stets alle vier.`
                    }
                },
                patterns: {
                    title: `Empfohlene Patterns`,
                    intro: `Wiederkehrende Layouts und Verdrahtungen, die jede MOWS-App teilen soll. Kopiere die Snippets als Startpunkt und passe sie von dort aus an.`,
                    sidebar: {
                        title: `Sidebar-Layout`,
                        body: `Greife zum \`<Sidebar>\`-Primitiv, sobald die App mehr als ein oder zwei Top-Level-Oberflächen hat. Fixiere oben einen Header mit dem eigenen Logo und Namen deiner App — verwende NICHT das MOWS-Logo, das gehört der Plattform und nicht deiner App. Navigiere zwischen den Oberflächen über \`<SidebarContent>\` und packe \`<PrimaryMenu variant="inline" />\` in den Footer, damit Theme- / Sprach- / Auth-Steuerungen über jede MOWS-App hinweg an einer konsistenten Stelle leben. Die Doku-Sidebar links nutzt genau diesen Aufbau.`
                    }
                },
                actions: {
                    title: `Aktionen`,
                    intro: `Jedes vom Nutzer auslösbare Verb in deiner App — „Dokument anlegen“, „Zeile löschen“, „Einstellungen öffnen“ — sollte eine \`Action\` sein. Eine Definition fließt in vier Aufrufsoberflächen zugleich: die Command Palette (Strg/Cmd-K), den Hotkey-Manager, das globale Kontextmenü (Rechtsklick) und direktes Dispatch aus deiner eigenen UI. Dieselbe id landet in localStorage (zuletzt verwendet, eigene Shortcuts) und im Tastenkürzel-Editor, sodass Nutzer alles, was du ausspielst, neu binden und wiederfinden können.`,
                    define: {
                        title: `Eine Aktion definieren`,
                        body: `Eine \`Action\` ist eine stabile id + Kategorie + Map von Handlern, geschlüsselt nach \`scope\`. Das \`getState()\` des Handlers liefert eine \`ActionVisibility\` und optional \`icon\` / \`label\`, sodass dieselbe Zeile in der Command Palette oder im Kontextmenü Live-Status übernimmt (z. B. ausgeblendet, wenn die Berechtigung fehlt; deaktiviert, wenn noch nicht anwendbar). Halte ids namensbereinigt (\`myapp.document.create\`) — sie überleben Umbenennungen in der Persistenz und sitzen sitzungsübergreifend. Bevorzuge \`ActionVisibility.Disabled\` gegenüber \`Hidden\`, wenn die Aktion kontextuell nicht verfügbar ist, damit Nutzer sie weiter entdecken können.`
                    },
                    register: {
                        title: `Beim Provider registrieren`,
                        body: `Übergib deine Aktionen an \`<MowsProvider extraActions={…}>\`. Eingebaute Core-Aktionen (Command Palette öffnen, Einstellungen öffnen, Login/Logout, …) werden automatisch zusammengeführt. Ab hier lösen Hotkeys für jede id automatisch deinen Handler aus, und \`actionManager.dispatchAction(id)\` funktioniert von überall via \`useMows()\`. Der \`<CommandPalette />\`-Mount greift sie ebenfalls auf — deshalb sind alle vier App-Shell-Mounts nicht verhandelbar (siehe Setup oben).`
                    },
                    contextMenu: {
                        title: `Rechtsklick-Kontextmenüs`,
                        body: `MOWS-Apps sollten zeilenbezogene Verben über \`<GlobalContextMenu />\` ausspielen, statt eigene Popover zu bauen. Markiere jede interaktive DOM-Region mit \`data-actionscope="<scope-name>"\` plus beliebigen \`data-*\`-Payload, den der Handler braucht (id, Name, aktueller Status). Beim Rechtsklick innerhalb einer markierten Region öffnet sich das Menü mit jeder Aktion, deren Handler für diesen Scope registriert ist. Das \`executeAction\` des Handlers bekommt den ursprünglichen Click-Event und das markierte Element als Argumente — lies Identifikatoren von diesem Element ab, statt das DOM erneut zu traversieren. Außerhalb markierter Regionen feuert weiterhin das native Browser-Menü, damit Kopieren / Einfügen / Untersuchen unberührt bleiben.`
                    },
                    variants: {
                        title: `Modifier-Tasten-Varianten`,
                        body: `Eine Aktion kann ihr Label, Icon und ihren Handler unter einer Modifier-Tasten-Kombination via \`variants\` morphen. Der Klassiker: eine Zeile „In den Papierkorb verschieben“ wird zu „Endgültig löschen“, während Shift gehalten wird — das Menü rendert live neu, sobald der Nutzer den Modifier hält oder loslässt. Varianten werden in Reihenfolge gegen die Live-Modifier-Maske aufgelöst; das erste passende Prädikat gewinnt, also packe die spezifischsten Varianten zuerst. Der Auflösungs- und Dispatch-Pfad wird mit dem Rechtsklick-Menü und der Command Palette geteilt, sodass das Verhalten über alle Oberflächen hinweg konsistent bleibt.`
                    }
                }
            }
        },
        examples: {
            _harness: {
                codeTab: `Code`,
                stateTab: `State`,
                noStateReported: `Dieses Beispiel meldet keinen Zustand.`
            },
            steps: {
                horizontal: {
                    title: `Horizontale Schrittanzeige`,
                    description: `Standardmäßige horizontale Anordnung. Der Status wird aus dem kontrollierten „current“-Index abgeleitet.`
                },
                endAlignment: {
                    title: `End-Ausrichtung`,
                    description: `endAlignment steuert, wie sich der erste und letzte Schritt entlang der Reihe verankern. „side“ (Standard) drückt sie an die Reihenränder mit links-/rechtsbündigem Label; „center“ zentriert jedes Label unter seinem Indikator. In beiden Modi bleiben die Indikatoren gleichmäßig verteilt.`
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
                loading: {
                    title: `Ladezustand`,
                    description: `Ladezustand pro Schritt. loading={true} ergibt einen unbestimmten Spinner um den Indikator; loading={n} (0–100) ergibt einen Fortschrittsring, den du aus eigenem State speist.`
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
                        endAlignment: {
                            title: `End-Ausrichtung`,
                            description: `Direkter Vergleich von endAlignment="side" (erstes/letztes Label an den Reihenrändern) und endAlignment="center" (jedes Label zentriert). In beiden bleiben die Indikatoren gleichmäßig verteilt.`
                        },
                        vertical: {
                            title: `Vertikal`,
                            description: `Schritte vertikal stapeln, mit der Verbindungslinie zwischen den Indikatoren.`
                        },
                        loading: {
                            title: `Ladezustand`,
                            description: `Direkter Vergleich von loading={true} (unbestimmter Spinner) und loading={n} (bestimmter Fortschrittsring, gespeist aus Komponentenstate).`
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
                            throwsOutsideSteps: `<Step> außerhalb von <Steps> zu rendern wirft einen aussagekräftigen Fehler.`,
                            endAlignmentSide: `Mit endAlignment="side" ist das Label des ersten Schritts linksbündig und das des letzten rechtsbündig; mittlere Labels bleiben zentriert.`,
                            endAlignmentCenter: `Mit endAlignment="center" ist das Label jedes Schritts unter seinem Indikator zentriert — auch das erste und das letzte.`,
                            loadingIndeterminate: `loading auf einem <Step> umrahmt den Indikator mit einem unbestimmten Spinner-Ring.`,
                            loadingDeterminate: `loading={n} (0–100, geklemmt) umrahmt den Indikator mit einem Fortschrittsring, der als role="progressbar" mit aria-valuenow exponiert wird.`
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
            sectionHeading: {
                default: {
                    title: `Standard`,
                    description: `Eine einzelne Permalink-Überschrift. Hover über den Text unterstreicht ihn und zeigt die gedämpfte #-Markierung; ein Klick schreibt #<id> in die URL.`
                },
                levels: {
                    title: `Ebenen`,
                    description: `Ein <SectionHeading> pro Überschriftenebene (h1–h6). Die Komponente rendert die gewünschte Ebene per React.createElement; das Styling liegt beim Konsumenten (via className).`
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
                        body: `Importiere <SectionHeading> aus dem Paket und rendere es mit einer id (wird beim Klick zur URL-Hash) und der Überschriften-Ebene. Style die Überschrift via className.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<SectionHeading> ist ein schlanker Wrapper um das native <hN>-Element. Es besitzt den Anker-Link, das Setzen der Hash beim Klick und die Hover-Unterstreichung + gedämpfte #-Markierung. Die visuelle Gestaltung bleibt beim Konsumenten.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Eine einzelne h2-Überschrift mit der Standard-Hover-Affordanz.`
                        },
                        levels: {
                            title: `Ebenen`,
                            description: `Alle sechs Überschriften-Ebenen nebeneinander gerendert.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <SectionHeading> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersLevel: `Rendert die angeforderte Überschriftenebene (h1–h6) mit der angegebenen id.`,
                            defaultsToH2: `Verwendet h2 als Standard, wenn keine Ebene angegeben ist.`,
                            anchorHref: `Wickelt den Text in einen Anker, dessen href zur id passt.`,
                            pushesHash: `Ein Klick auf die Überschrift schreibt #<id> per history.pushState in die URL.`,
                            noDuplicateHistory: `Erzeugt keinen doppelten History-Eintrag, wenn die Hash bereits aktuell ist.`,
                            preventsDefaultScroll: `Verhindert das Default-Scrollen des Browsers, damit scrollToSection greift.`,
                            hoverUnderlineText: `Unterstreicht beim Hover nur den Überschriftentext, nicht die #-Markierung.`,
                            dimMarker: `Rendert eine gedämpfte #-Markierung, die beim Hover erscheint und nicht unterstrichen wird.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Überschriften erben die Richtung vom DOM-Vorfahren — ein umgebendes dir="rtl" verschiebt die #-Markierung an den Anfang der Überschrift.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <SectionHeading> akzeptiert.`
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
            audioPlayer: {
                bar: {
                    title: `Bar-Variante`,
                    description: `Ein kompaktes einzeiliges Pill-Layout für Listen, Kommentare und Tabellenzellen. Die prozedurale Wellenform füllt die verfügbare Breite.`
                },
                card: {
                    title: `Card-Variante`,
                    description: `Hero-Layout mit Cover, Titel und Untertitel über einer höheren Wellenform — geeignet als dedizierte Wiedergabeoberfläche.`
                },
                minimal: {
                    title: `Minimal-Variante`,
                    description: `Bar-Layout, aber mit einem normalen shadcn-Slider statt der Wellenform — sinnvoll, wenn das umgebende Chrome bereits dicht ist oder die Wellenform dekorativ wirken würde.`
                },
                peaks: {
                    title: `Vorgegebene Peaks`,
                    description: `Übergib ein Array aus Werten in [0, 1] an die Prop \`peaks\`, wenn dir serverseitig vorab analysierte Wellenformdaten vorliegen.`
                },
                rtl: {
                    title: `Rechts-nach-links`,
                    description: `Mit \`dir="rtl"\` spiegelt das umgebende Chrome — der Abspielkopf folgt aber weiterhin der Zeitachse von links nach rechts.`
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
                        body: `Übergib eine aufgelöste \`src\`-URL — der Player verkabelt im Hintergrund ein verstecktes \`<audio>\`-Element und rendert eine eigene Bedienoberfläche darüber.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Die Bar-Variante ist Standard. Mit \`variant="card"\` wechselst du in das Hero-Layout und übergibst \`title\`, \`subtitle\` sowie \`artwork\`. Über \`peaks\` lässt sich die prozedurale Wellenform durch vorab analysierte Daten ersetzen.`
                    },
                    examples: {
                        title: `Beispiele`,
                        bar: {
                            title: `Bar-Variante`,
                            description: `Kompakter Player im Listenformat. Die prozedurale Wellenform wird deterministisch aus der Quell-URL abgeleitet, wenn keine \`peaks\`-Prop angegeben ist.`
                        },
                        card: {
                            title: `Card-Variante`,
                            description: `Hero-Layout mit Cover links und einer höheren Wellenform rechts.`
                        },
                        minimal: {
                            title: `Minimal-Variante`,
                            description: `Gleiches Pill-Chrome wie die Bar-Variante, jedoch mit einem regulären Slider statt der Wellenform — passend für ohnehin dichte Kontexte.`
                        },
                        peaks: {
                            title: `Vorgegebene Peaks`,
                            description: `Überschreibe die prozedurale Wellenform mit einem expliziten \`peaks\`-Array — nützlich für serverseitig analysierte Quellen.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich \`<AudioPlayer>\` verhalten soll, jeweils mit Verweis auf den Test, der das absichert.`,
                        verifiedBy: `Geprüft durch`,
                        statements: {
                            defaultBar: `Rendert die \`bar\`-Variante, wenn keine \`variant\`-Prop angegeben ist.`,
                            cardVariant: `Rendert das Hero-Layout mit Titel und Untertitel bei \`variant="card"\`.`,
                            playPauseToggle: `Die Play-Schaltfläche wechselt das Label, sobald das Audio-Element \`play\`/\`pause\` feuert.`,
                            muteToggle: `Ein Klick auf den Mute-Button schaltet das darunterliegende \`audio.muted\`-Flag um.`,
                            durationLoad: `Zeigt die Gesamtdauer, sobald \`loadedmetadata\` feuert.`,
                            keyboardSpace: `Die Leertaste auf dem Player-Root steuert Wiedergabe und Pause.`,
                            keyboardSkip: `Pfeil-Rechts spult 5 s vor, Pfeil-Links 5 s zurück.`,
                            errorAlert: `Zeigt eine Inline-Fehlermeldung samt Retry-Button, wenn das Media-Element \`error\` feuert.`,
                            peaksOverride: `Rendert eine Bar pro Eintrag im \`peaks\`-Array statt der prozeduralen Wellenform.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter \`dir="rtl"\` spiegelt das umgebende Flex-Chrome. Die Wellenform selbst bleibt zeitlich orientiert — der Abspielkopf folgt der Audio-Zeitachse, nicht der Schreibrichtung.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die \`<AudioPlayer>\` akzeptiert.`
                    }
                }
            },
            lyrics: {
                basic: {
                    title: `Klassisches LRC`,
                    description: `Zeitsynchroner Liedtext, geparst aus einem klassischen LRC-String. Die aktive Zeile wird hervorgehoben und mittig gehalten; inaktive Zeilen blenden mit Abstand aus.`
                },
                compact: {
                    title: `Kompakte Variante`,
                    description: `Gleicher Parser, ohne Auto-Scroll und ohne Ausblendung — geeignet für dichte Oberflächen wie Seitenleisten oder Karten-Footer, wenn die gesamte Liedtextliste auf einen Blick lesbar bleiben soll.`
                },
                karaoke: {
                    title: `Wort-Ebene (Enhanced LRC)`,
                    description: `Enhanced-LRC-Quellen verteilen \`<mm:ss.xx>\`-Marker zwischen den Wörtern. Die Komponente hebt das aktive Wort hervor, sobald die Zeitachse weiterläuft.`
                },
                synced: {
                    title: `Synchron mit Audio`,
                    description: `Verbunden mit einem HTML-\`<audio>\`-Element — drücke Play und beobachte, wie die aktive Zeile dem Abspielkopf folgt. Ein Klick auf eine Zeile springt im Audio zurück.`
                },
                rtl: {
                    title: `Rechts-nach-links`,
                    description: `Mit \`dir="rtl"\` umschlossen. Die Zeilen bleiben mittig und in zeitlicher Reihenfolge, aber die umgebende Schreibrichtung kehrt sich um.`
                },
                syncedDemo: {
                    instructions: `Drücke Play und beobachte, wie die aktive Zeile dem Abspielkopf folgt. Klick auf eine Zeile springt im Audio zurück.`,
                    toggleAriaLabel: `Wiedergabe umschalten`
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
                        body: `Übergib der Komponente einen rohen LRC-String (oder einen vorab geparsten \`ParsedLyrics\`-Wert) sowie die aktuelle Wiedergabezeit in Sekunden. Sie findet die aktive Zeile, scrollt sie optional ins Bild und stellt einen Seek-Callback bereit, damit Klicks auf eine Zeile dein Audio-Element steuern können.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Die Variante \`scrolling\` ist Standard und scrollt die aktive Zeile automatisch in die Mitte. Mit \`variant="compact"\` erhältst du eine statische Liste. Für die Audio-Kopplung leitest du \`audio.currentTime\` an \`currentTime\` weiter und verdrahtest \`onSeek\` zurück auf \`audio.currentTime\` — kein zusätzlicher Hook nötig.`
                    },
                    examples: {
                        title: `Beispiele`,
                        basic: {
                            title: `Klassisches LRC`,
                            description: `Die aktive Zeile wird über einen Slider gesteuert, der ein Audio-Element ersetzt. Auto-Scroll hält sie im Bild.`
                        },
                        compact: {
                            title: `Kompakte Variante`,
                            description: `Gleiche Quelle, gerendert ohne Auto-Scroll und ohne Fade — passend für enge Oberflächen.`
                        },
                        karaoke: {
                            title: `Wortgenaue Hervorhebung`,
                            description: `Enhanced LRC mit \`<mm:ss.xx>\`-Markern pro Wort. Das aktive Wort übernimmt im Verlauf die Primärfarbe.`
                        },
                        synced: {
                            title: `Verbunden mit <audio>`,
                            description: `Drücke Play, um den Liedtext aus einem echten HTML-Audio-Element zu treiben. Klick auf eine Zeile springt im Audio zurück.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich \`<Lyrics>\` verhalten soll, jeweils mit Verweis auf den Test, der das absichert.`,
                        verifiedBy: `Geprüft durch`,
                        statements: {
                            parsesMetadata: `Liest \`[ti:]\`-, \`[ar:]\`- und \`[al:]\`-Tags aus dem Quelltext in die geparsten Metadaten.`,
                            expandsRepeats: `Erweitert wiederholte \`[mm:ss.xx][mm:ss.xx]\`-Präfixe zu separaten Zeilen, sodass Refrains pro Zeitstempel einmal erscheinen.`,
                            karaokeWords: `Erkennt Enhanced-LRC-\`<mm:ss.xx>\`-Marker und legt pro-Wort-Zeitstempel auf der geparsten Zeile offen.`,
                            appliesOffset: `Wendet die \`[offset:ms]\`-Korrektur an und verschiebt jeden Zeitstempel.`,
                            activeIndex: `Wählt die Zeile, deren Startzeitpunkt der größte Wert \`<= currentTime\` ist.`,
                            seekOnClick: `Feuert \`onSeek\` mit der Startzeit der geklickten Zeile, wenn die Komponente interaktiv ist.`,
                            seekOnEnter: `Feuert \`onSeek\`, wenn Enter auf einer fokussierten Zeile gedrückt wird.`,
                            emptySource: `Rendert den Leerzustand mit \`data-state="empty"\`, wenn die Quelle keine verwertbaren Zeilen enthält.`,
                            noClickWithoutSeek: `Lässt die interaktive Rolle komplett weg, wenn kein \`onSeek\`-Callback verdrahtet ist.`,
                            preparsed: `Akzeptiert einen vorab geparsten \`ParsedLyrics\`-Wert, ohne den Parser erneut auszuführen.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Umschließe die Komponente mit \`dir="rtl"\`, um die umgebende Schreibrichtung zu spiegeln. Die Zeilen bleiben zentriert und zeitlich geordnet — gespiegelt werden nur die umgebenden Inhalte und die Prosa darum.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die \`<Lyrics>\` akzeptiert.`
                    }
                }
            },
            fileIcon: {
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
                        body: `Importiere <FileIcon> aus dem Paket und übergib einen fileName. Die Komponente löst das passende Material-Icon auf und greift bei fehlender Übereinstimmung sanft auf einen Fallback zurück.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<FileIcon> bündelt das vollständige 1109-Icon-Set als Vite-Assets, sodass Konsumenten die SVGs nicht in ihrem eigenen public/ spiegeln müssen. Schlägt das Laden des SVGs selbst fehl, wird auf ein lucide-File-Glyph zurückgegriffen.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Gängige Dateitypen`,
                            description: `Ein Raster bekannter Endungen und exakter Namenstreffer.`
                        },
                        sizes: {
                            title: `Größen`,
                            description: `Dasselbe Icon in verschiedenen Pixelgrößen.`
                        },
                        fallback: {
                            title: `Unbekannte Endungen`,
                            description: `Was passiert, wenn kein Treffer gefunden wird.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <FileIcon> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            resolvesAll: `Löst Endungen, exakte Namen und den Default-Fallback in Prioritätsreihenfolge auf.`,
                            extension: `Eine Dateiendung allein löst zum passenden Icon auf.`,
                            exactName: `Ein exakter Dateinamens-Treffer gewinnt gegen die Endung.`,
                            defaultFallback: `Unbekannte Endungen rendern das Default-File-Icon.`,
                            sizeForwarded: `Die size-Prop wird an width + height des gerenderten <img> weitergereicht.`,
                            rerendersOnFileName: `Eine Änderung des fileName-Props löst zu einem neuen Icon auf.`,
                            lucideFallback: `Schlägt das Laden des SVGs fehl, wird der lucide-File-Fallback angezeigt.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Das Icon ist ein quadratisches <img> — seine visuelle Ausrichtung ist richtungsneutral. Ein umgebendes dir="rtl" lässt das Icon unverändert.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <FileIcon> akzeptiert.`
                    }
                },
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
            videoViewer: {
                default: {
                    title: `Progressives MP4`,
                    description: `Standard-video/mp4 wird progressiv über MediaSource Extensions ausgeliefert. Der Seek-Bar-Tooltip zeigt eine Live-Vorschau des überfahrenen/gezogenen Frames: ein verstecktes off-screen <video> + <canvas> erfasst Frames on demand, und die Hauptplayer-Fläche aktualisiert sich live beim Scrubbing. Der Slider-Daumen bleibt am Cursor fixiert, bis der Seek tatsächlich landet — er springt nicht zurück, während der neue Bereich gepuffert wird.`
                },
                dash: {
                    title: `DASH-Manifest`,
                    description: `application/dash+xml mit mehreren Bitratenvarianten. Die Qualitäts-Schaltfläche zeigt, welche Variante Shakas ABR gerade abspielt; eine konkrete Variante deaktiviert ABR, der Eintrag „Auto“ schaltet ABR wieder ein. Liefert das Manifest ein Thumbnail-AdaptationSet, ersetzt die Seek-Vorschau das Frame-Grab-Bild automatisch durch das vorgerenderte Sprite.`
                },
                hls: {
                    title: `HLS-Playlist`,
                    description: `application/vnd.apple.mpegurl-Playlist mit mehreren Renditions. Gleicher Dispatch-Pfad wie DASH — Shaka parst beides mit demselben Player, dieselben Bedienverhalten (Qualität, Untertitel, Drag-Scrub-Vorschau) gelten.`
                },
                chapters: {
                    title: `Kapitel`,
                    description: `Übergib <VideoViewer> ein chapters-Array, und die Seek-Leiste erhält Strich-Marken an jeder Kapitelgrenze; der Hover/Drag-Tooltip blendet den passenden Kapiteltitel über dem Zeitstempel ein.`
                },
                controls: {
                    title: `Steuerungs-Showcase`,
                    description: `Wechsle zwischen progressiver, DASH- und HLS-Quelle, um alle Bedienelemente auszuprobieren. Bewege den Zeiger, damit die Leiste sichtbar bleibt; fokussiere den Player und drücke Leertaste, Pfeiltasten, m, f, p oder c für die Tastaturkürzel. Das Wiedergaberate-Popover bietet sowohl einen stufenlosen Schieberegler (0,25× – 3×) als auch Voreinstellungen.`
                },
                doc: {
                    installation: {
                        title: `Installation`,
                        commandTab: `Befehl`,
                        manualTab: `Manuell`,
                        manualStep1: `Installiere die folgenden Abhängigkeiten:`,
                        manualStep2: `Kopiere und füge den folgenden Code in dein Projekt ein.`,
                        manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.`
                    },
                    usage: {
                        title: `Verwendung`,
                        body: `Übergib <VideoViewer> eine aufgelöste src-URL und einen mimeType. Standard-video/*-Formate werden progressiv (über MediaSource) abgespielt, DASH/HLS-Manifeste adaptiv. Das Backend muss HTTP-Range-Requests unterstützen und Content-Range / Accept-Ranges / Content-Length über CORS exponieren.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<VideoViewer> wird normalerweise über <FileViewer> erreicht; dieser lädt ihn lazy hinter einer Suspense-Grenze, damit Aufrufer ohne Video die ca. 256 kB shaka-player nicht bezahlen. Direkte Nutzung funktioniert ebenfalls — einfach in einen dimensionierten Container packen.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Progressives MP4`,
                            description: `Standard-video/mp4 über MediaSource. Zeigt das Live-Drag-Scrubbing: die Hauptplayer-Fläche aktualisiert sich beim Ziehen, der schwebende Tooltip zeigt an jeder Position ein Frame-Grab-Thumbnail plus Zeitstempel, und der Slider bleibt an der Freigabeposition fixiert, bis <currentTime> ankommt (5-s-Watchdog falls der Seek stillschweigend fehlschlägt).`
                        },
                        dash: {
                            title: `DASH-Manifest`,
                            description: `Multi-Bitraten-DASH. Die Qualitäts-Schaltfläche zeigt, was ABR gewählt hat; der Auto-Menüeintrag spiegelt dasselbe in Klammern plus Stufen-Badge. Manifeste mit Thumbnail-Track ersetzen die Frame-Grab-Vorschau automatisch durch das vorgerenderte Sprite.`
                        },
                        hls: {
                            title: `HLS-Playlist`,
                            description: `Mehrere HLS-Renditions — gleicher Dispatch-Pfad wie DASH. Über/Ziehen über die Leiste, um zu sehen, dass der Frame-Grab-Fallback bei HLS-Dateien genauso funktioniert wie bei MP4.`
                        },
                        chapters: {
                            title: `Kapitel`,
                            description: `Übergib ein chapters-Array, und die Seek-Leiste erhält YouTube-artige Strich-Marken an jeder Kapitelgrenze. Der Hover/Drag-Tooltip blendet den passenden Kapiteltitel neben dem Zeitstempel ein, damit der Nutzer „wo im Clip“ und „welches Kapitel“ gleichzeitig sieht.`
                        },
                        controls: {
                            title: `Steuerungs-Showcase`,
                            description: `Wechsle zwischen progressiver, DASH- und HLS-Quelle, um alle Bedienelemente und Tastaturkürzel auszuprobieren. Das Wiedergaberate-Popover bietet sowohl einen stufenlosen Schieberegler (0,25× – 3×) als auch Voreinstellungen.`
                        }
                    },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`,
                        intro: `Aussagen darüber, wie sich <VideoViewer> verhalten soll, jeweils mit dem Test verlinkt, der sie verifiziert.`,
                        verifiedBy: `verifiziert durch`,
                        statements: {
                            dispatchByMime: `<FileViewer> reicht video/*-MIME-Typen an <VideoViewer> weiter.`,
                            dispatchManifest: `<FileViewer> reicht DASH- und HLS-Manifest-MIME-Typen an <VideoViewer> weiter.`,
                            recognisesManifests: `Die isVideoOrStream-Hilfsfunktion erkennt video/* und alle unterstützten Streaming-Manifest-MIME-Typen.`,
                            constructsOnePlayer: `Jedes Mounten installiert Shaka-Polyfills einmalig und konstruiert genau einen Player.`,
                            nativeFallback: `Wenn shaka.Player.isBrowserSupported() false liefert, fällt die Komponente auf ein natives <video controls> zurück.`,
                            reusesOnSrcChange: `Ein Wechsel der src-Prop lädt den bestehenden Player neu, statt einen neuen zu konstruieren.`,
                            cleansUpOnUnmount: `Beim Unmounten wird Player.destroy() genau einmal aufgerufen.`,
                            keyboardTogglePlay: `Leertaste und k schalten Wiedergabe/Pause des fokussierten Players um.`,
                            keyboardModifierGuard: `Tastaturkürzel ignorieren modifierkombinierte Tasten, damit Browser-Shortcuts (Cmd+F, Strg+R, …) weiterhin funktionieren.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Die Videofläche ist richtungsneutral. Die Steuerleiste ordnet ihre rechtsbündige Aktionsgruppe mit logischer (start/end) Flex-Reihenfolge an, sodass dir="rtl" die Gruppe korrekt spiegelt — ohne Zusatzverkabelung.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <VideoViewer> akzeptiert.`
                    }
                }
            },
            codeThemePicker: {
                popover: {
                    title: `Popover-Trigger`,
                    description: `Standardform: eine Trigger-Schaltfläche, die eine durchsuchbare Theme-Liste in einem Popover öffnet. Verwende sie, wenn der Picker in einem Einstellungsmenü leben soll.`
                },
                standalone: {
                    title: `Eigenständig`,
                    description: `Rendert Suche + Liste inline, ohne Popover-Trigger. Verwende es, wenn der Picker die gesamte UI ist (z. B. eine eigene Theme-Auswahl-Seite).`
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
                        body: `Importiere <CodeThemePicker> und rendere ihn. Er liest die verfügbaren Code-Themes und das aktuell aktive aus <MowsProvider> und ruft setCodeTheme bei einer Auswahl auf.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<CodeThemePicker> verdrahtet Radix Popover + Command (mit Suche) mit dem Code-Theme-Status aus <MowsProvider>. Setze standalone, um das Popover zu überspringen und die durchsuchbare Liste inline anzuzeigen.`
                    },
                    examples: {
                        title: `Beispiele`,
                        popover: {
                            title: `Popover-Trigger`,
                            description: `Trigger-Schaltfläche + Popover-Liste.`
                        },
                        standalone: {
                            title: `Eigenständig`,
                            description: `Inline-Suchliste, kein Popover.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <CodeThemePicker> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            showsCurrent: `Zeigt den aktuellen Code-Theme-Namen auf dem Trigger.`,
                            listsAll: `Listet jedes registrierte Theme, wenn geöffnet (standalone).`,
                            callsSetCodeTheme: `Ruft setCodeTheme im umgebenden MowsContext auf, wenn ein Theme ausgewählt wird.`,
                            filtersBySearch: `Filtert die Theme-Liste anhand der getippten Suchanfrage.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Der Picker erbt die Richtung von seinem DOM-Vorfahren — ein umgebendes dir="rtl" dreht Trigger + Suchfeld nach rechts-nach-links.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <CodeThemePicker> akzeptiert.`
                    }
                }
            },
            codeViewer: {
                default: {
                    title: `Standard`,
                    description: `Eine schreibgeschützte, Monaco-gestützte Code-Ansicht mit Zeilennummern, Syntax-Hervorhebung und Zeilenumbruch.`
                },
                editable: {
                    title: `Bearbeitbar`,
                    description: `Setze editable, damit der Nutzer tippen kann. Binde onCodeChange, um den neuen Wert beim Editieren zu erhalten.`
                },
                fitContent: {
                    title: `An Inhalt anpassen`,
                    description: `fitContent passt die Wrapper-Höhe an Monacos Inhaltshöhe an — keine interne Scrollleiste. Kombiniere es mit <ExpandableCode>, um lange Snippets einzuklappen.`
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
                        body: `Importiere <CodeViewer> und übergib code + language. Das Monaco-Bundle wird per React.lazy nachgeladen — Apps, die keinen Viewer rendern, zahlen das Bundle nicht.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<CodeViewer> umschließt Monacos Standalone-Editor mit sinnvollen Defaults (Zeilennummern / Umbruch / Whitespace-Markierung / Syntax-Hervorhebung). Er respektiert das aktive Code-Theme aus <MowsProvider>; Konsumenten können Anzeigeoptionen je Instanz überschreiben.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Schreibgeschützte Ansicht mit Zeilennummern und Syntax-Hervorhebung.`
                        },
                        editable: {
                            title: `Bearbeitbar`,
                            description: `editable + onCodeChange machen aus dem Viewer einen kleinen Editor.`
                        },
                        fitContent: {
                            title: `An Inhalt anpassen`,
                            description: `Der Wrapper wächst auf Monacos volle Inhaltshöhe.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <CodeViewer> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersLazyEditor: `Rendert den lazy-geladenen Monaco-Editor mit dem übergebenen Code.`,
                            forwardsClassName: `Reicht className an den Editor-Wrapper weiter.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Quellcode ist richtungsneutral. Ein umgebendes dir="rtl" lässt die Token-Reihenfolge unverändert; nur der Fließtext-Fluss kehrt sich um.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <CodeViewer> akzeptiert.`
                    }
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
            },
            primaryMenu: {
                inline: {
                    title: `Inline`,
                    description: `Full-width-Trigger für eine Sidebar-Footer-Zeile — Klicks öffnen das Dropdown ober- oder unterhalb des Triggers.`
                },
                fixed: {
                    title: `Fixiert`,
                    description: `Pinnt den Trigger an eine Viewport-Ecke. In einer echten App liegt er über jeder Seite; die Vorschau verwendet einen positionierten Wrapper.`
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
                        body: `Mounte <PrimaryMenu> genau einmal innerhalb von <MowsProvider>. Es bietet Login / Logout, Sprache- / Theme- / Code-Theme-Picker, den Tastenkürzel-Editor und den Einstellungsdialog.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<PrimaryMenu> kombiniert <DropdownMenu> mit den Picker-Komponenten und dem Modal-Manager. Die "fixed"-Variante pinnt an eine Viewport-Ecke; "inline" passt sich einem Sidebar-Footer an.`
                    },
                    examples: {
                        title: `Beispiele`,
                        inline: {
                            title: `Inline`,
                            description: `variant="inline" — Full-width-Trigger.`
                        },
                        fixed: {
                            title: `Fixiert`,
                            description: `Standard-Variante — oben rechts angepinnt.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <PrimaryMenu> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            loginVisibleWhenAuthConfigured: `Zeigt den Login-Eintrag, wenn Auth konfiguriert ist und der Nutzer nicht angemeldet ist.`,
                            loginHiddenWhenAuthNotConfigured: `Blendet den Login-Eintrag komplett aus, wenn keine OIDC-Konfiguration an <MowsProvider> übergeben wurde.`,
                            providerWithoutOidcYieldsNoAuth: `Ein echter <MowsProvider> ohne oidc-Prop liefert authConfigured=false — und kein Login-Eintrag erscheint.`,
                            dropsLeadingSeparator: `Lässt den führenden Separator über "Sprache" weg, wenn es keinen Auth-Bereich darüber zum Trennen gibt.`,
                            keepsSeparatorWithLogin: `Behält den Separator zwischen Login und Sprache, wenn der Login-Eintrag sichtbar ist.`,
                            inlineRendersFullWidth: `variant="inline" rendert einen Full-width-Trigger (keine fixed-Positionierung) und zeigt den Anzeigenamen neben dem Avatar, wenn angemeldet.`,
                            inlineLoggedOutMenuIcon: `variant="inline" zeigt im abgemeldeten Zustand nur das Menü-Icon (kein Text) — die openMenu-Beschriftung lebt im title-Attribut.`,
                            staleSessionTreatedAsLoggedOut: `Eine gecachte authentifizierte Session wird als abgemeldet behandelt, wenn authConfigured=false — weder Login- noch Logout-Eintrag erscheinen.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Das Menü erbt die Schreibrichtung vom Vorfahren. Ein umgebendes dir="rtl" spiegelt Avatar / Icon / Chevron im Trigger.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <PrimaryMenu> akzeptiert.`
                    }
                }
            },
            globalContextMenu: {
                default: {
                    title: `Rechtsklick-Ziel`,
                    description: `Eine umrandete Drop-Zone, deren data-actionscope mit dem GlobalContextMenu verbunden ist. Rechtsklick in der Box öffnet das Menü an der Cursorposition.`
                },
                submenus: {
                    title: `Untermenüs`,
                    description: `Gibt der ActionHandler.children() weitere Actions zurück, rendert das Menü ein Untermenü. Am Aufrufer ändert sich nichts — du beschreibst Daten, der Renderer wählt automatisch DropdownMenuSub.`
                },
                modifierVariants: {
                    title: `Modifier-Varianten`,
                    description: `Eine Action kann Varianten anhand gedrückter Modifiertasten deklarieren. Shift gedrückt halten verwandelt „In den Papierkorb verschieben“ live in „Endgültig löschen“; ein Shift-Klick überspringt den Bestätigungsdialog. Der ausgeführte Zweig wird aus event.shiftKey neu aufgelöst — wird Shift vor dem Klick losgelassen, läuft sicher der Standardzweig.`
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
                        body: `Mounte <GlobalContextMenu> einmal innerhalb von <MowsProvider>. Jedes Nachkommen-Element mit data-actionscope="<scope>" fängt das native Kontextmenü ab und öffnet stattdessen das Menü an der Cursorposition.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<GlobalContextMenu> sucht vom Rechtsklick-Ziel im DOM nach dem nächsten [data-actionscope], fragt den <ActionManager> nach passenden Actions und rendert sie über <DropdownMenu>.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Rechtsklick-Ziel`,
                            description: `Die gestrichelte Fläche unten trägt data-actionscope; mache einen Rechtsklick darauf.`
                        },
                        submenus: {
                            title: `Untermenüs`,
                            description: `Rechtsklick — „Teilen“ öffnet sich in Link kopieren / E-Mail / Slack über einen ActionHandler.children-Resolver.`
                        },
                        modifierVariants: {
                            title: `Modifier-Varianten`,
                            description: `Rechtsklick auf das Ziel, dann Shift halten, um die Affordance von „In den Papierkorb“ auf „Endgültig löschen“ umzuschalten. Im State-Tab unten wird festgehalten, welcher Zweig lief.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <GlobalContextMenu> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            positionsAtCursor: `Positioniert den Trigger-Wrapper exakt auf den Cursorkoordinaten, damit das Menü unter dem Klick öffnet.`,
                            sideOffsetZero: `Öffnet mit sideOffset=0, sodass die Menü-Oberkante am Cursor und nicht darunter beginnt.`,
                            suppressesNativeOnlyWhenMatched: `Unterdrückt das native Kontextmenü nur dann, wenn der Action-Scope unter dem Cursor mindestens eine registrierte Action hat.`,
                            doesNotSuppressWhenScopeEmpty: `Lässt das native Kontextmenü durch, wenn der Scope unter dem Cursor keine Actions hat.`,
                            clickItemDispatches: `Beim Auswählen eines Eintrags wird die Action ausgelöst und das native Kontextmenü verhindert.`,
                            updatesOnSecondClick: `Aktualisiert die Cursorposition bei jedem weiteren Rechtsklick, statt am ersten Klick zu kleben.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Das Menü erbt die Schreibrichtung vom Vorfahren; Einträge kippen unter dir="rtl". Die Cursor-Verankerung nutzt Viewport-Koordinaten und ist richtungsneutral.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <GlobalContextMenu> akzeptiert.`
                    }
                }
            },
            copyValueButton: {
                label: {
                    title: `Mit Label`,
                    description: `Zeigt das Label neben dem Kopier-Icon. Verwende es, wenn der Wert sonst nicht sichtbar ist.`
                },
                iconOnly: {
                    title: `Nur Icon`,
                    description: `Lass das Label weg für kompakte Platzierungen (z. B. in einer Token-Zeile).`
                },
                withToast: {
                    title: `Mit Toast`,
                    description: `Setze toastOnCopy, um beim erfolgreichen Kopieren einen Sonner-Toast zu feuern. Ein String überschreibt den Standardtext "Copied".`
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
                        body: `Übergib value. Klicks kopieren ihn in die Zwischenablage und schalten das Icon ca. 1,5 s lang auf ein Häkchen.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<CopyValueButton> kapselt navigator.clipboard mit einem transienten "kopiert"-Zustand und einem optionalen Sonner-Toast. Das sichtbare Label ist optional — über title lässt sich der vollständige Wert per nativem Tooltip anzeigen.`
                    },
                    examples: {
                        title: `Beispiele`,
                        label: {
                            title: `Mit Label`,
                            description: `Label neben dem Icon.`
                        },
                        iconOnly: {
                            title: `Nur Icon`,
                            description: `Kein Label — für Inline-Platzierungen.`
                        },
                        withToast: {
                            title: `Mit Toast`,
                            description: `Feuert beim Kopieren einen Sonner-Toast.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <CopyValueButton> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersLabelWhenProvided: `Rendert das Label, wenn eines übergeben wird.`,
                            omitsLabelWhenAbsent: `Lässt das Label weg, wenn keines übergeben wurde.`,
                            writesClipboardOnClick: `Schreibt den Wert beim Klick in die Zwischenablage.`,
                            showsCopiedTitleTransient: `Zeigt nach erfolgreichem Kopieren ca. 1,5 s lang den "Copied!"-Titel und setzt ihn dann zurück.`,
                            firesToastWhenTrue: `Feuert einen Toast, wenn toastOnCopy true ist (Standardtext).`,
                            usesProvidedToastMessage: `Verwendet den übergebenen String als Toast-Nachricht, wenn toastOnCopy ein String ist.`,
                            noToastWhenOmitted: `Feuert keinen Toast, wenn toastOnCopy weggelassen wird.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" tauschen Label und Icon die Reihenfolge — das Icon sitzt links vom Label.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <CopyValueButton> akzeptiert.`
                    }
                }
            },
            buttonSelect: {
                default: {
                    title: `Standard`,
                    description: `Drei Optionen, gruppiert zu einem Segmented Control. Die ausgewählte Option erhält den Accent-Hintergrund; die anderen die Outline-Variante.`
                },
                disabled: {
                    title: `Gruppe deaktiviert`,
                    description: `disabled deaktiviert jede Option in der Gruppe. Für ein schreibgeschütztes Segmented Control.`
                },
                disabledOption: {
                    title: `Option deaktiviert`,
                    description: `Pro-Option-Deaktivierung — nur diese Option ist inaktiv; die übrigen reagieren weiterhin auf Klicks.`
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
                        body: `Übergib options als { id, icon, label?, disabled? } und einen kontrollierten selectedId. onSelectionChange feuert mit der neuen id.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<ButtonSelect> stapelt <Button>-Primitive zu einer Gruppe und teilt sich die Ränder — so liest sich das Ergebnis wie ein einziges Steuerelement. role="group" sitzt auf dem äußeren Wrapper; aria-pressed spiegelt die ausgewählte Option.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Drei Optionen, eine ausgewählt.`
                        },
                        disabled: {
                            title: `Gruppe deaktiviert`,
                            description: `Alle Optionen deaktiviert.`
                        },
                        disabledOption: {
                            title: `Option deaktiviert`,
                            description: `Eine Option deaktiviert.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <ButtonSelect> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersAllOptions: `Rendert jede Option als Button in der Gruppe.`,
                            selectedDefaultVariant: `Markiert die ausgewählte Option mit dem Accent-Hintergrund.`,
                            nonSelectedOutline: `Rendert nicht-ausgewählte Optionen mit der Outline-Variante.`,
                            clickFiresChange: `Ruft onSelectionChange auf, wenn eine Option geklickt wird.`,
                            disabledOptionNoChange: `Ruft onSelectionChange nicht auf, wenn eine deaktivierte Option geklickt wird.`,
                            groupDisabledNoChange: `Ruft onSelectionChange nicht auf, wenn die gesamte Gruppe deaktiviert ist.`,
                            forwardsClassName: `Reicht className an den äußeren Gruppen-Wrapper durch.`,
                            forwardsStyle: `Reicht style an den äußeren Gruppen-Wrapper durch.`,
                            accessibility: `Exponiert role="group" und ein aria-pressed-Attribut, das die ausgewählte Option widerspiegelt.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Das Segmented Control folgt der umgebenden Schreibrichtung. Unter dir="rtl" sitzt die erste Option rechts und rundet den rechten Rand.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <ButtonSelect> akzeptiert.`
                    }
                }
            },
            settingsPanel: {
                default: {
                    title: `Standard`,
                    description: `Drei Sektionen: Erscheinungsbild, Code-Editor, Sprache. Ein zweiter Tab zeigt das Live-JSON, sodass Power-User einen Settings-Blob einfügen können.`
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
                        body: `Mounte <SettingsPanel> innerhalb von <MowsProvider>. Es liest / schreibt Theme, Code-Theme, Sprache, Code-Editor-Einstellungen und Toast-Einstellungen im umgebenden Context.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<SettingsPanel> verknüpft <ThemePicker>, <CodeThemePicker>, <LanguagePicker>, die Code-Editor-Toggles und den Toast-Position-Picker — plus einen JSON-Tab, der das gesamte MowsSettings-Objekt durchschleust.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Das gesamte Panel in einem 640px hohen Container.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <SettingsPanel> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            threeHeadings: `Rendert die drei Sektionsüberschriften (Erscheinungsbild, Code-Editor, Sprache).`,
                            standalonePickersShowCurrent: `Verwendet die standalone-Variante der Theme- / Code-Theme- / Sprache-Picker und zeigt ihre aktuellen Werte.`,
                            jsonTabShowsSettings: `Der JSON-Tab zeigt die aktuellen Einstellungen live an.`,
                            jsonSaveAppliesEdit: `Editieren des JSONs und Klick auf Speichern überträgt die neuen Werte in den Context.`,
                            notificationsSection: `Rendert die Sektion "Benachrichtigungen" mit dem Toast-Position-Picker.`,
                            jsonIncludesToast: `Bezieht die Toast-Einstellungen in die JSON-Ansicht mit ein.`,
                            toastPositionFromJson: `Übernimmt toast.position aus dem editierten JSON in den umgebenden Context.`,
                            jsonErrorOnInvalid: `Zeigt eine Fehlermeldung, wenn das editierte JSON ungültig ist.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Das Sektionslayout spiegelt unter dir="rtl"; der JSON-Tab ist richtungsneutral.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <SettingsPanel> akzeptiert.`
                    }
                }
            },
            terminal: {
                default: {
                    title: `Standard`,
                    description: `Lazy geladene xterm.js-Oberfläche mit einer kleinen Echo-„Shell", die über onData angebunden ist. „Clear" ruft das imperative Handle auf.`
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
                        body: `<Terminal> ist eine lazy geladene xterm.js-Oberfläche. Der Konsument treibt das Terminal über das imperative TerminalHandle (write / writeln / clear / focus / fit) anstatt über einen "value"-Prop.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Kombiniere <Terminal> mit onData (Nutzereingabe) und onReady (Initial-Banner / Fokus). xterm + CSS (~250 KB) werden lazy geladen — Konsumenten ohne <Terminal> zahlen sie nie.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Echo-Shell`,
                            description: `Kleine In-Process-„Shell", die getippte Zeichen echot und bei Enter einen Prompt schreibt.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Terminal> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            suspendsAndMounts: `Zeigt den Suspense-Fallback, während der xterm-Chunk lädt, und mountet danach xterm.`,
                            forwardsHandle: `Reicht das imperative Handle (write / writeln / clear / focus / fit) durch die Lazy-Grenze.`,
                            firesOnData: `Ruft onData auf, wenn xterm Nutzereingaben meldet.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Terminal-Output ist zeilenorientiert und richtungsneutral. xterm dreht Glyphen unter dir="rtl" nicht.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Terminal> akzeptiert, sowie das via ref bereitgestellte TerminalHandle.`
                    }
                }
            },
            logView: {
                default: {
                    title: `Zeilen anhängen`,
                    description: `Jeder Klick hängt eine Zeile an und der View scrollt automatisch ans Ende. Das Suchfeld filtert case-insensitiv per Substring; das Mülleimer-Icon ruft onClear auf.`
                },
                hideToolbar: {
                    title: `Ohne Toolbar`,
                    description: `hideToolbar entfernt Suche + Clear — nützlich, wenn die umgebende Chrome diese Steuerung schon liefert.`
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
                        body: `<LogView> ist vollständig kontrolliert — der Konsument besitzt das lines-Array und den Clear-Handler. Solange der Nutzer unten steht, autoscrollt der View; sobald er nach oben scrollt, pausiert das Autoscroll bis er wieder ans Ende kommt.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<LogView> umschließt eine <ScrollArea> mit einer Toolbar (<SearchInput> + Clear-Button). Lokalisierbar via placeholders. Mit hideToolbar lebt die Toolbar außerhalb der View.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Zeilen anhängen`,
                            description: `„Push line" hängt eine Beispielzeile an; die Suche filtert in Echtzeit.`
                        },
                        hideToolbar: {
                            title: `Ohne Toolbar`,
                            description: `Nur die scrollbare Anzeige — für Embeds, die die Toolbar woanders zeigen.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <LogView> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersAllLines: `Rendert jede Zeile aus dem lines-Prop.`,
                            emptyPlaceholder: `Zeigt den Leer-Platzhalter, wenn keine Zeilen vorliegen.`,
                            filtersBySearch: `Filtert Zeilen per case-insensitivem Substring.`,
                            emptyWhenFilteredOut: `Zeigt den Leer-Platzhalter, wenn der Filter nichts trifft.`,
                            hidesClearWhenNoCallback: `Blendet den Clear-Button aus, wenn onClear weggelassen wird.`,
                            invokesOnClear: `Ruft onClear beim Klick auf den Clear-Button auf.`,
                            hideToolbar: `Blendet die Toolbar aus, wenn hideToolbar gesetzt ist.`,
                            reflectsLineUpdates: `Übernimmt Änderungen am lines-Prop sofort.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Zeilen bleiben in Quellreihenfolge; die Toolbar spiegelt unter dir="rtl", sodass der Clear-Button am führenden Rand sitzt.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <LogView> akzeptiert.`
                    }
                }
            },
            machineMonitor: {
                default: {
                    title: `Mit einem VNC-Server verbinden`,
                    description: `Füge eine ws://- oder wss://-URL ein und klicke „Connect". Der Viewer lädt das react-vnc-Bundle bei der ersten Verbindung.`
                },
                readOnly: {
                    title: `Read-only-Vorschau`,
                    description: `readOnly impliziert viewOnly UND verhindert Auto-Focus beim Hover, unterdrückt den Punkt-Cursor und lässt die Seite durch das Canvas scrollen.`
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
                        body: `<MachineMonitor> ist ein lazy geladener react-vnc-/@novnc/novnc-Wrapper. Übergib entweder url oder einen vorab konstruierten websocket; alles weitere läuft über das imperative MachineMonitorHandle.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<MachineMonitor> kapselt das VncScreen mit einem Suspense-Fallback, optionaler pointer-events-Unterdrückung für readOnly-Vorschauen und einem imperativen Handle (connect / disconnect / sendCtrlAltDel / clipboardPaste / shutdown / reboot / reset).`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Live-Verbindung`,
                            description: `Gib eine ws://-URL ein und verbinde dich. In der Doku ist kein Server angeschlossen.`
                        },
                        readOnly: {
                            title: `Read-only-Vorschau`,
                            description: `readOnly erzwingt viewOnly und unterdrückt Pointer-Events.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <MachineMonitor> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            remountsOnUrl: `Mountet das innere VncScreen neu, wenn sich das url-Prop ändert.`,
                            readOnlyForcesViewOnly: `readOnly erzwingt viewOnly + deaktiviert focusOnClick und den Punkt-Cursor.`,
                            readOnlyPointerEventsNone: `readOnly umschließt das Canvas mit einem pointer-events:none-Element, sodass die Seite hindurchscrollen kann.`,
                            noPointerEventsWithoutReadOnly: `Setzt pointer-events:none nicht, wenn readOnly weggelassen wird.`,
                            preservesExplicitViewOnly: `Behält ein explizit gesetztes viewOnly bei, wenn readOnly nicht gesetzt ist.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Das Remote-Framebuffer liegt in der Verantwortung des Servers; der Wrapper ist richtungsneutral.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <MachineMonitor> akzeptiert, sowie das via ref bereitgestellte MachineMonitorHandle.`
                    }
                }
            },
            sidebar: {
                default: {
                    title: `Header / Inhalt / Footer`,
                    description: `Zusammengesetzt aus <SidebarHeader>, <SidebarContent> (mit <SidebarGroup> + <SidebarMenu>) und <SidebarFooter>. collapsible="icon" hält den Icon-Streifen sichtbar.`
                },
                iconCollapsible: {
                    title: `Auf Icon-Streifen einklappbar`,
                    description: `<Sidebar collapsible="icon"> wechselt zwischen voller <SidebarProvider>-Breite und einem 3rem schmalen Icon-Streifen. Der Zustand liegt am <SidebarProvider>; <SidebarTrigger> klappt um, ⌘B / Strg+B global ebenfalls.`
                },
                collapsibleGroups: {
                    title: `Aufklappbare Gruppen`,
                    description: `Jedes <SidebarMenuItem> wird in <Collapsible> verpackt, die Unterpunkte liegen in <SidebarMenuSub>. Der Chevron rotiert anhand des data-state, und die Unterliste zeichnet die senkrechte Akzentlinie an der führenden Kante.`
                },
                resizable: {
                    title: `Mit Größenänderung`,
                    description: `Ziehe den rechten Rand, um die Breite zu ändern. Die Breite wird auf [minWidthPx, maxWidthPx] geklemmt und im Cookie sidebar_width gespeichert. Doppelklick auf den Griff setzt auf defaultWidthPx zurück.`
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
                        body: `Umschließe die umgebende Chrome mit <SidebarProvider> und platziere <Sidebar> dort, wo die Spalte leben soll. Der Provider besitzt open / collapsed / width; useSidebar() liefert das den Nachkommen.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<Sidebar> kombiniert Header- / Inhalt- / Footer-Slots, dazu Group / GroupLabel / GroupContent / Menu / MenuItem / MenuButton für Menübäume. <SidebarProvider> sichert open + width in Cookies, damit das Layout einen Reload überlebt.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Header / Inhalt / Footer`,
                            description: `Eine statische Sidebar mit drei Menüeinträgen.`
                        },
                        iconCollapsible: {
                            title: `Auf Icon-Streifen einklappbar`,
                            description: `Über den Schalter im Header (oder ⌘B / Strg+B) lässt sich die Sidebar zwischen voller Breite und dem schmalen Icon-Streifen umschalten. Bei schmaler Sidebar verschwinden die Labels hinter Tooltips.`
                        },
                        collapsibleGroups: {
                            title: `Aufklappbare Gruppen`,
                            description: `Top-Level-Gruppen mit Icon und Chevron, der sich beim Aufklappen dreht. Unterpunkte werden unter einer senkrechten Akzentlinie gerendert.`
                        },
                        resizable: {
                            title: `Mit Größenänderung`,
                            description: `Ziehe den rechten Rand; Doppelklick setzt zurück.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Sidebar> + <SidebarProvider> verhalten sollen, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            cssVarApplies: `Verwendet Tailwind-v4-var()-Syntax, sodass die Breite tatsächlich greift.`,
                            seedsDefaultWidth: `Initialisiert --sidebar-width beim Mount aus defaultWidthPx.`,
                            rendersHandleWhenResizable: `Rendert den Resize-Griff, wenn resizable gesetzt ist.`,
                            noHandleWhenNotResizable: `Rendert keinen Resize-Griff, wenn resizable false ist.`,
                            dragPersists: `Aktualisiert die Breite beim Ziehen und persistiert sie im sidebar_width-Cookie.`,
                            clampsToMax: `Klemmt das Ziehen auf maxWidthPx.`,
                            clampsToMin: `Klemmt das Ziehen auf minWidthPx.`,
                            doubleClickReset: `Doppelklick auf den Griff setzt die Breite auf defaultWidthPx zurück.`,
                            restoresFromCookie: `Stellt eine gesicherte Breite beim Mount aus dem sidebar_width-Cookie wieder her.`,
                            reclampsPersisted: `Klemmt eine gesicherte Breite neu, wenn sie außerhalb der aktuellen [min, max]-Grenzen liegt.`,
                            dragsInwardOnRight: `Zieht nach innen, wenn die Sidebar rechts verankert ist.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" bleibt die Sidebar an ihrer deklarierten Seite verankert; nur der Innen-Inhalt spiegelt. side="right" + RTL spiegelt das LTR-Layout effektiv.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props der wichtigsten Sidebar-Oberflächen. Die volle Menge (Header / Footer / Group / Menu …) wird aus @mows/react-components exportiert.`
                    }
                }
            },
            tabs: {
                default: {
                    title: `Standard`,
                    description: `Unkontrolliert — übergib defaultValue und lass <Tabs> den aktiven Tab verwalten.`
                },
                disabled: {
                    title: `Deaktivierter Trigger`,
                    description: `Markiere einen Trigger als disabled, um den Panel-Eingang aus der UI-Navigation zu nehmen. Der Inhalt ist unerreichbar.`
                },
                controlled: {
                    title: `Kontrolliert`,
                    description: `Mit value + onValueChange steuerst du die Tabs von außen.`
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
                        body: `<Tabs> ist Radix Tabs im new-york-Style von shadcn. Jeder <TabsTrigger value> muss exakt einem <TabsContent value> entsprechen.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Kombiniere <Tabs> mit <TabsList> (Trigger-Reihe) und <TabsContent>-Panels. defaultValue / value steuern den aktiven Panel; disabled deaktiviert einzelne Trigger; orientation tauscht die Pfeil-Navigation.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Drei Trigger, einer aktiv.`
                        },
                        disabled: {
                            title: `Deaktivierter Trigger`,
                            description: `Der dritte Trigger ist deaktiviert — sein Panel ist unerreichbar.`
                        },
                        controlled: {
                            title: `Kontrolliert`,
                            description: `value + onValueChange steuern den aktiven Tab von außen.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Tabs> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            showsDefaultPanel: `Zeigt beim ersten Render den Panel zu defaultValue.`,
                            switchesOnClick: `Wechselt den sichtbaren Panel beim Klick auf einen Trigger.`,
                            dataStateActive: `Markiert den aktiven Trigger via data-state="active" / "inactive".`,
                            disabledNoActivate: `Aktiviert einen deaktivierten Trigger nicht.`,
                            controlledValue: `Respektiert ein kontrolliertes value-Prop — der aktive Panel folgt dem Eltern-State.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegelt die Trigger-Reihe und die Pfeil-Navigation dreht sich, sodass Links/Rechts zum visuell benachbarten Trigger führen.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Tabs>, <TabsTrigger> und <TabsContent> akzeptieren.`
                    }
                }
            },
            badge: {
                default: {
                    title: `Standard`,
                    description: `Die Standard-Variante nutzt die Primärfarbe und rendert solide auf dem Seitenhintergrund.`
                },
                variants: {
                    title: `Varianten`,
                    description: `Alle verfügbaren Varianten. Die vier Status-Varianten (success / warning / info / muted) sind app-übergreifende Konventionen für Ressourcen-Status.`
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
                        body: `<Badge> ist ein kleines Inline-Element für Status. Übergib children als Label und optional eine variant für das Farbschema.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<Badge> umschließt children mit einem gestylten div. Alle HTML-div-Attribute werden durchgereicht.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Die Basis-Variante.`
                        },
                        variants: {
                            title: `Varianten`,
                            description: `Acht visuelle Behandlungen.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Badge> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersChildren: `Rendert children innerhalb der Badge-Fläche.`,
                            defaultVariantClasses: `Wendet ohne variant-Prop die Default-Klassen (bg-primary / text-primary-foreground) an.`,
                            eachVariantClasses: `Jede Variante wendet ihre erwarteten Tailwind-Klassen für Hintergrund + Vordergrund an (secondary / destructive / outline / success / warning / info / muted).`,
                            forwardsClassName: `Reicht ein zusätzliches className durch, ohne die Variant-Klassen zu verlieren.`,
                            forwardsAttributes: `Reicht beliebige HTML-Attribute (z. B. data-*) ans gerenderte Element durch.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Badges sind richtungsneutral — die Reihenfolge innerhalb folgt der Schreibrichtung des Containers.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Badge> akzeptiert.`
                    }
                }
            },
            button: {
                default: {
                    title: `Standard`,
                    description: `Der Basis-Button — Primärhintergrund, Standard-Größe.`
                },
                variants: {
                    title: `Varianten`,
                    description: `Sechs eingebaute visuelle Behandlungen. iconStandalone ist eine transparente Variante für Icon-only-Buttons ohne Container-Chrome.`
                },
                sizes: {
                    title: `Größen`,
                    description: `sm / default / lg + drei icon-* Größen für quadratische Icon-Buttons.`
                },
                asChild: {
                    title: `asChild`,
                    description: `Rendert das Button-Styling per Radix Slot auf das einzige Kind-Element — typisch für Links mit Button-Look ohne <button> in einem <a> zu verschachteln.`
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
                        body: `<Button> rendert ein natives <button> mit den shadcn-Variant- und Größenklassen. Alle nativen Button-Attribute (onClick, type, disabled …) werden durchgereicht.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Mit asChild wird das Styling stattdessen auf das einzige Kind-Element gelegt — der typische Fall ist das Umschließen eines <Link> / <a>.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Der Basis-Button.`
                        },
                        variants: {
                            title: `Varianten`,
                            description: `default / secondary / destructive / outline / ghost / link.`
                        },
                        sizes: {
                            title: `Größen`,
                            description: `sm / default / lg + drei icon-* Größen.`
                        },
                        asChild: {
                            title: `asChild`,
                            description: `Styling auf ein <a> übertragen.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Button> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersNativeButton: `Rendert ohne asChild ein natives <button>.`,
                            defaultVariantAndSize: `Wendet ohne explizite variant/size die Default-Werte an.`,
                            appliesVariants: `Jede Variante wendet ihre erwarteten Tailwind-Klassen an (destructive / outline / secondary / ghost / link / iconStandalone).`,
                            appliesSizes: `Jede Größe wendet ihre erwarteten Höhen-/Padding-Klassen an (sm / lg / icon / icon-sm / icon-lg / icon-xs).`,
                            firesOnClick: `Feuert onClick beim Klick.`,
                            noClickWhenDisabled: `Feuert onClick nicht, wenn disabled gesetzt ist.`,
                            asChildRendersChild: `asChild rendert das Kind-Element (z. B. <a>) statt eines nativen Buttons, mit dem Button-Styling.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Buttons erben die Schreibrichtung vom Vorfahren; Icon- und Label-Reihenfolge spiegelt unter dir="rtl".`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Button> akzeptiert.`
                    }
                }
            },
            card: {
                default: {
                    title: `Header / Inhalt / Footer`,
                    description: `Eine vollständige Card mit Titel + Beschreibung im Header, Body und Aktions-Buttons im Footer.`
                },
                headerOnly: {
                    title: `Nur Header`,
                    description: `Cards funktionieren auch nur mit Header — jeder Slot ist optional.`
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
                        body: `Kombiniere <Card> mit den Slots Header / Title / Description / Content / Footer. Jeder Slot ist unabhängig — wenn du einen weglässt, bleibt das umgebende Spacing intakt.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Jeder Card-Slot ist ein einfacher forwardRef-div mit shadcn-Typo- und Padding-Klassen. Alle div-Attribute werden durchgereicht.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Header / Inhalt / Footer`,
                            description: `Card mit allen Slots gefüllt.`
                        },
                        headerOnly: {
                            title: `Nur Header`,
                            description: `Nur <CardHeader> mit Titel + Beschreibung.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich die Card-Oberflächen verhalten sollen, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            shell: `Rendert das Card-Gehäuse mit abgerundetem Rand und Card-Hintergrund.`,
                            slotOrder: `Rendert Header / Title / Description / Content / Footer in DOM-Reihenfolge.`,
                            titleTypography: `<CardTitle> trägt die Heading-Typo-Klassen (font-semibold, text-2xl).`,
                            descriptionColour: `<CardDescription> nutzt das muted-foreground-Farbtoken.`,
                            refForwarding: `Jede Card-Unterkomponente reicht ein ref ans gerenderte div durch.`,
                            classNameMerge: `Jede Card-Unterkomponente merged ein übergebenes className mit ihren Basis-Klassen.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Cards sind richtungsneutral; innere Flex-Container (Footer, Header) spiegeln unter dir="rtl", sodass Aktions-Buttons am führenden Rand bleiben.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Alle Card-Unterkomponenten teilen sich dieselben Props — jede ist ein forwardRef-div.`
                    }
                }
            },
            checkbox: {
                default: {
                    title: `Standard`,
                    description: `In <Label> einwickeln, damit Klicks auf das Label die Checkbox umschalten.`
                },
                indeterminate: {
                    title: `Unbestimmt`,
                    description: `Übergib checked="indeterminate" für die Tri-State-Glyphe — nützlich für „Alle auswählen"-Header bei partieller Auswahl.`
                },
                disabled: {
                    title: `Deaktiviert`,
                    description: `disabled deaktiviert beide Zustände (unchecked und checked).`
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
                        body: `<Checkbox> ist tri-state — übergib true / false / "indeterminate" via checked. onCheckedChange feuert mit dem neuen Wert.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<Checkbox> kapselt die Radix-Checkbox und rendert das Lucide-Check-Icon als Indikator. In <Label> einwickeln für ein klickbares Label.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Kontrollierte Checkbox in einem <Label>.`
                        },
                        indeterminate: {
                            title: `Unbestimmt`,
                            description: `Tri-State-Modus.`
                        },
                        disabled: {
                            title: `Deaktiviert`,
                            description: `Beide Varianten (unchecked und checked) deaktiviert.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Checkbox> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            defaultUnchecked: `Rendert standardmäßig unchecked (data-state="unchecked").`,
                            indicatorWhenChecked: `Rendert den Check-Indikator nur, wenn checked.`,
                            defaultCheckedOnMount: `Übernimmt defaultChecked beim ersten Mount.`,
                            firesOnCheckedChange: `Feuert onCheckedChange beim Klick im unkontrollierten Modus.`,
                            fullyControllable: `Ist vollständig steuerbar via checked + onCheckedChange.`,
                            noToggleWhenDisabled: `Schaltet nicht um, wenn disabled gesetzt ist.`,
                            indeterminateDataState: `Exponiert den unbestimmten Zustand via data-state="indeterminate".`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Die Checkbox ist quadratisch — richtungsneutral. Label-/Checkbox-Reihenfolge folgt der Schreibrichtung.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Checkbox> akzeptiert.`
                    }
                }
            },
            switch: {
                default: {
                    title: `Standard`,
                    description: `Boolesches On/Off — kein unbestimmter Zustand.`
                },
                disabled: {
                    title: `Deaktiviert`,
                    description: `disabled deaktiviert sowohl den Off- als auch den On-Zustand.`
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
                        body: `<Switch> ist die Radix-Switch-Primitive — ein boolescher Ein/Aus-Toggle. onCheckedChange feuert mit dem neuen Boolean.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<Switch> kapselt die Radix-Switch-Primitive. In <Label> einwickeln, damit Klicks auf das Label umschalten. Im Gegensatz zu <Checkbox> gibt es keinen unbestimmten Zustand.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Kontrollierter Switch in einem <Label>.`
                        },
                        disabled: {
                            title: `Deaktiviert`,
                            description: `Deaktiviert Off / Deaktiviert On.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Switch> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            defaultUnchecked: `Rendert standardmäßig unchecked (data-state="unchecked").`,
                            defaultCheckedOnMount: `Übernimmt defaultChecked beim ersten Mount.`,
                            firesOnCheckedChange: `Feuert onCheckedChange beim Klick im unkontrollierten Modus.`,
                            fullyControllable: `Ist vollständig steuerbar via checked + onCheckedChange.`,
                            noToggleWhenDisabled: `Schaltet nicht um, wenn disabled gesetzt ist.`,
                            thumbTranslates: `Der Thumb verschiebt sich nur, wenn checked.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Der Switch-Track liegt horizontal. Unter dir="rtl" gleitet der Thumb weiterhin von der führenden zur nachfolgenden Kante — visuell spiegelt das das LTR-Verhalten.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Switch> akzeptiert.`
                    }
                }
            },
            collapsible: {
                default: {
                    title: `Standard`,
                    description: `Unkontrolliert — defaultOpen initialisiert den Zustand und der Trigger kippt ihn. data-state am Trigger erlaubt das Animieren des Chevrons.`
                },
                controlled: {
                    title: `Kontrolliert`,
                    description: `Steuere open aus eigenem State mit onOpenChange. Ein externer Button und der eingebettete Trigger teilen sich dieselbe Quelle.`
                },
                nested: {
                    title: `Verschachtelte Menügruppen`,
                    description: `Sidebar-ähnliche Menügruppen: Icon, Label, ein über data-state rotierender Chevron und eingerückte Unterpunkte hinter einer senkrechten Akzentlinie — dasselbe Muster wie im Sidebar-Beispiel "Aufklappbare Gruppen", aber nur mit Collapsible + Tailwind nachgebaut.`
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
                        body: `<Collapsible> kapselt das Radix-Collapsible-Primitive. Platziere einen <CollapsibleTrigger> neben <CollapsibleContent>; beide Kinder erhalten data-state="open" | "closed", sodass CSS darauf reagieren kann.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Setze group/collapsible auf das Root-Element, damit Nachfahren den geöffneten Zustand abfragen können. Ein Chevron mit group-data-[state=open]/collapsible:rotate-180 ist die typische Affordance.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Unkontrolliert mit defaultOpen und Chevron-Icon.`
                        },
                        controlled: {
                            title: `Kontrolliert`,
                            description: `Zwei Trigger — externer Button und eingebetteter Trigger — teilen sich einen Zustand.`
                        },
                        nested: {
                            title: `Verschachtelte Menügruppen`,
                            description: `Icon + Chevron + eingerückte Unterpunkte mit senkrechter Akzentlinie — das Sidebar-Muster, aus Collapsible-Primitiven gebaut.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Collapsible> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            closedByDefault: `Rendert standardmäßig geschlossen (data-state="closed", aria-expanded="false").`,
                            reflectsDefaultOpen: `Übernimmt defaultOpen beim ersten Mount.`,
                            opensClosesOnClick: `Öffnet und schließt beim Klick auf den Trigger.`,
                            firesOnOpenChange: `Feuert onOpenChange beim Umschalten.`,
                            fullyControllable: `Ist vollständig steuerbar via open + onOpenChange.`,
                            disabledNoToggle: `Schaltet nicht um, wenn disabled gesetzt ist.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `<Collapsible> ist richtungsneutral — es rendert selbst keine richtungsgebundene Affordance. Kinder erben das umliegende dir-Attribut, sodass das Layout unter dir="rtl" natürlich spiegelt.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Collapsible>, <CollapsibleTrigger> und <CollapsibleContent> akzeptieren.`
                    }
                }
            },
            input: {
                default: {
                    title: `Mit Label`,
                    description: `Kombiniere <Input> mit <Label htmlFor> für barrierefreie Beschriftung.`
                },
                types: {
                    title: `Häufige Typen`,
                    description: `text / password / number — alle HTML-input-Typen werden durchgereicht.`
                },
                disabled: {
                    title: `Deaktiviert`,
                    description: `disabled deaktiviert das Eingabefeld und dimmt es ab.`
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
                        body: `<Input> ist ein gestylter Wrapper um das native <input>. Alle nativen Attribute werden durchgereicht (type, value, onChange, placeholder, disabled, autoComplete …).`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Kombiniere mit <Label htmlFor> für barrierefreie Beschriftung. value + onChange für kontrollierten Modus.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Mit Label`,
                            description: `Beschrifteter Email-Input.`
                        },
                        types: {
                            title: `Häufige Typen`,
                            description: `text / password / number.`
                        },
                        disabled: {
                            title: `Deaktiviert`,
                            description: `Deaktiviertes Nur-Lese-Feld.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Input> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersTextInput: `Rendert standardmäßig ein natives input-Element.`,
                            forwardsType: `Reicht das type-Attribut (z. B. password) ans native input weiter.`,
                            firesOnChange: `Feuert onChange beim Tippen.`,
                            fullyControllable: `Ist vollständig steuerbar via value + onChange.`,
                            noInputWhenDisabled: `Akzeptiert keine Eingabe, wenn disabled gesetzt ist.`,
                            forwardsRef: `Reicht ein ref ans zugrundeliegende input-Element durch.`,
                            classNameMerge: `Merged ein eigenes className mit den Basis-Klassen.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" dreht sich das Input: Cursor startet rechts, Placeholder und Auswahl folgen der Schreibrichtung.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Input> akzeptiert.`
                    }
                }
            },
            label: {
                default: {
                    title: `Einwickeln`,
                    description: `Den Control im Label einwickeln — Klicks auf den Label-Bereich schalten den Control um.`
                },
                htmlFor: {
                    title: `htmlFor`,
                    description: `Wenn der Control außerhalb des Labels lebt, htmlFor verwenden. Klicks auf das Label fokussieren das passende Input.`
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
                        body: `<Label> kapselt die Radix-Label-Primitive mit shadcn-Typo. Mit Form-Controls kombinieren — Klicks aufs Label fokussieren das zugehörige Input.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Zwei gleichwertige Muster: Control im Label einwickeln ODER htmlFor auf die ID des Controls setzen.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Einwickeln`,
                            description: `Checkbox im <Label> verschachtelt.`
                        },
                        htmlFor: {
                            title: `htmlFor`,
                            description: `Label neben einem separaten Input.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Label> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersNativeLabel: `Rendert ein natives label-Element.`,
                            typographyClasses: `Trägt die Heading-Typo-Klassen (text-sm, font-medium).`,
                            htmlForFocuses: `Reicht htmlFor durch und fokussiert beim Klick das passende Input.`,
                            classNameMerge: `Merged ein eigenes className mit den Basis-Klassen.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Labels folgen der umgebenden Schreibrichtung. Der Label-Text liest RTL, wenn in dir="rtl" eingewickelt.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Label> akzeptiert.`
                    }
                }
            },
            textarea: {
                default: {
                    title: `Mit Label`,
                    description: `Mehrzeilige Eingabe. Mindesthöhe 60px; mit rows={n} oder einem className vergrößern.`
                },
                disabled: {
                    title: `Deaktiviert`,
                    description: `disabled deaktiviert das Tippen und dimmt das Textarea ab.`
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
                        body: `<Textarea> ist ein gestylter Wrapper um das native <textarea>. Alle nativen Attribute werden durchgereicht (rows, value, onChange, placeholder, disabled …).`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Mit rows={n} oder h-{n} die Größe setzen. value + onChange für kontrollierten Modus.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Mit Label`,
                            description: `Beschriftetes Bio-Textarea.`
                        },
                        disabled: {
                            title: `Deaktiviert`,
                            description: `Nur-Lese-Textarea mit Default-Wert.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Textarea> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersNativeTextarea: `Rendert ein natives textarea-Element.`,
                            firesOnChange: `Feuert onChange beim Tippen.`,
                            fullyControllable: `Ist vollständig steuerbar via value + onChange.`,
                            forwardsRef: `Reicht ein ref ans zugrundeliegende textarea-Element durch.`,
                            disabledPreventsTyping: `Disabled verhindert Tippen.`,
                            baseStyling: `Trägt die Mindesthöhen- und Rundungs-Klassen.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" dreht sich das Textarea, sodass der Cursor rechts startet.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Textarea> akzeptiert.`
                    }
                }
            },
            skeleton: {
                default: {
                    title: `Avatar + Zeilen`,
                    description: `Eine gängige Lade-Form: runder Avatar plus zwei Textzeilen.`
                },
                card: {
                    title: `Card-Platzhalter`,
                    description: `Block + Heading + Body-Zeilen — verwendet, während eine echte Card lädt.`
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
                        body: `<Skeleton> ist ein pulsierend animiertes div. Mit Tailwind-Utility-Klassen (h-*, w-*, rounded-*) so dimensionieren, dass die ladende Inhalts-Form gespiegelt wird.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Mehrere Skeletons in derselben Form und DOM-Reihenfolge wie der echte Inhalt zusammenbauen. Beim Laden austauschen.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Avatar + Zeilen`,
                            description: `Gängige Platzhalter-Form.`
                        },
                        card: {
                            title: `Card-Platzhalter`,
                            description: `Bildblock + Heading + Body-Zeilen.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Skeleton> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            baseClasses: `Rendert ein div mit den Basis-Klassen animate-pulse + rounded.`,
                            forwardsClassName: `Reicht ein zusätzliches className für Größen-/Form-Overrides durch.`,
                            forwardsAttributes: `Reicht beliebige HTML-Attribute (z. B. id, data-*) durch.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Skeletons sind rein visuelle Rechtecke — richtungsneutral.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Skeleton> akzeptiert.`
                    }
                }
            },
            progress: {
                default: {
                    title: `Statischer Wert`,
                    description: `value=60 — der Indikator verschiebt sich um -(100 - value)%, um den gefüllten Teil freizulegen.`
                },
                animated: {
                    title: `Animiert`,
                    description: `Wert per Timer hochzählen, um eine animierte Fortschrittsanzeige zu treiben.`
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
                        body: `<Progress> ist die Radix-Progress-Primitive — übergib value (0-100). Der Indikator ist GPU-beschleunigt via transform: translateX.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `value aus externem State treiben, etwa für Upload-Progress, lang laufende Tasks usw. undefined → unbestimmter Zustand.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Statischer Wert`,
                            description: `Fester value=60.`
                        },
                        animated: {
                            title: `Animiert`,
                            description: `Timer-getriebener Fortschritt.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Progress> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersTrack: `Rendert die Spur als relativ positioniertes, overflow-hidden, rounded-full-Gehäuse.`,
                            translateAtZero: `Verschiebt den Indikator bei value=0 um -100%.`,
                            translateAtFifty: `Verschiebt den Indikator bei value=50 um -50%.`,
                            translateAtHundred: `Verschiebt den Indikator bei value=100 um 0.`,
                            omittedAsZero: `Behandelt einen weggelassenen / undefined Wert als 0.`,
                            classNameMerge: `Merged ein eigenes className mit den Basis-Klassen auf der Spur.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" füllt sich der Indikator vom rechten zum linken Rand — Radix spiegelt die Transform-Richtung automatisch.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Progress> akzeptiert.`
                    }
                }
            },
            dialog: {
                default: {
                    title: `Destruktive Aktion bestätigen`,
                    description: `Über den Button öffnet ein Modal-Dialog mit Titel, Body und Cancel/Delete-Aktionen im Footer.`
                },
                hideClose: {
                    title: `Ohne Eck-X`,
                    description: `showCloseButton={false} blendet das eingebaute Eck-X aus — nützlich, wenn das Schließen über eine explizite Footer-Aktion erfolgen muss.`
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
                        body: `<Dialog> kapselt Radix Dialog. Kombiniere mit <DialogTrigger>, <DialogContent>, <DialogHeader> (mit <DialogTitle> + <DialogDescription>), <DialogFooter> und <DialogClose>.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `DialogContent rendert standardmäßig ein Eck-X — mit showCloseButton={false} ausblenden. Escape und Overlay-Klicks schließen den Dialog ebenfalls.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Destruktive Aktion bestätigen`,
                            description: `Dialog mit Header + Body + Cancel/Delete-Footer.`
                        },
                        hideClose: {
                            title: `Ohne Eck-X`,
                            description: `showCloseButton={false} erzwingt explizite Footer-Aktion.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Dialog> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            closedByDefault: `Ist standardmäßig geschlossen — der Inhalt wird nicht gerendert.`,
                            defaultOpen: `Rendert den Inhalt, wenn defaultOpen gesetzt ist.`,
                            opensOnTrigger: `Öffnet sich beim Klick auf den Trigger.`,
                            ariaWiring: `Exponiert role="dialog" mit aria-labelledby / aria-describedby auf Title / Description.`,
                            closeButton: `Rendert einen eingebauten Schließen-Button mit Label "Close", der den Dialog beim Klick schließt.`,
                            closesOnEscape: `Schließt sich bei Escape.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" wandert das Eck-X an die führende Kante; Footer-Aktionen folgen der Schreibrichtung.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Dialog> und <DialogContent> akzeptieren. Die anderen Slots akzeptieren die nativen Attribute ihres jeweiligen Elements.`
                    }
                }
            },
            popover: {
                default: {
                    title: `Trigger + Body`,
                    description: `Minimaler Popover, am Trigger-Button verankert.`
                },
                form: {
                    title: `Inline-Formular`,
                    description: `Popovers sind nicht-modal — ideal für leichte Inline-Formulare (Umbenennen, Quick-Edit).`
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
                        body: `<Popover> kapselt die Radix-Popover-Primitive. Kombiniere mit <PopoverTrigger> und <PopoverContent>.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Popovers sind nicht-modal: Klicks außerhalb schließen, Fokus wird nicht eingefangen. Für modal blockierende Interaktionen <Dialog> verwenden.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Trigger + Body`,
                            description: `Minimaler Popover.`
                        },
                        form: {
                            title: `Inline-Formular`,
                            description: `Leichtes Formular im Popover.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Popover> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            closedByDefault: `Ist standardmäßig geschlossen — der Inhalt wird nicht gerendert.`,
                            defaultOpen: `Rendert den Inhalt, wenn defaultOpen gesetzt ist.`,
                            opensOnTrigger: `Öffnet sich beim Klick auf den Trigger.`,
                            closesOnEscape: `Schließt sich bei Escape.`,
                            portalsToBody: `Portaliert den Inhalt zum document.body — nicht ins Eltern-div des Triggers.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegeln Anker und Alignment des Popovers — Radix dreht align="start"/"end" automatisch.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Popover> und <PopoverContent> akzeptieren.`
                    }
                }
            },
            scrollArea: {
                default: {
                    title: `Vertikal scrollen`,
                    description: `30 Einträge in einem 48-hohen Viewport. Die Scrollleiste erscheint bei Überlauf.`
                },
                horizontal: {
                    title: `Horizontal scrollen`,
                    description: `Eine explizite <ScrollBar orientation="horizontal" /> rendern, um eine horizontale Scrollleiste zu bekommen — Radix rendert sie nicht automatisch.`
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
                        body: `<ScrollArea> kapselt die Radix-ScrollArea-Primitive. Container mit h-*/w-*-Utilities dimensionieren — bei Überlauf erscheint die custom-gestylte Scrollleiste.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Für horizontales Scrollen ein <ScrollBar orientation="horizontal" /> in der ScrollArea rendern. Über viewportRef kann man imperativ scrollen (z. B. Auto-Scroll bei LogView).`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Vertikal scrollen`,
                            description: `30 Items in einem 48-hohen Viewport.`
                        },
                        horizontal: {
                            title: `Horizontal scrollen`,
                            description: `Horizontal angeordnete Karten mit expliziter ScrollBar.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <ScrollArea> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            shell: `Rendert ein relativ positioniertes, overflow-hidden Gehäuse.`,
                            viewport: `Rendert die children in einem Viewport mit h-full / w-full.`,
                            viewportRef: `Reicht viewportRef an den inneren Viewport durch.`,
                            viewportClassName: `Merged viewportClassName auf den Viewport.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" sitzt die vertikale Scrollleiste am linken Rand; horizontales Scrollen folgt der Schreibrichtung.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <ScrollArea> und <ScrollBar> akzeptieren.`
                    }
                }
            },
            radioGroup: {
                default: {
                    title: `Kontrollierte Auswahl`,
                    description: `Drei Optionen, eine ausgewählt — onValueChange feuert mit dem neuen Wert beim Klick.`
                },
                disabledOption: {
                    title: `Option deaktiviert`,
                    description: `Ein einzelnes <RadioGroupItem disabled> aus der Auswahl ausschließen; der Rest der Gruppe bleibt interaktiv.`
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
                        body: `<RadioGroup> kapselt Radix RadioGroup. Jedes <RadioGroupItem value> muss in der Gruppe eindeutig sein.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Jedes Item in einem <Label> einwickeln für barrierefreie Beschriftung. Einzelne Items oder die ganze Gruppe deaktivieren.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Kontrollierte Auswahl`,
                            description: `Drei Optionen mit onValueChange.`
                        },
                        disabledOption: {
                            title: `Option deaktiviert`,
                            description: `Ein Item deaktiviert.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <RadioGroup> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersRadios: `Rendert jedes Item als radio.`,
                            roleRadiogroup: `Setzt role="radiogroup" auf den Wrapper.`,
                            defaultValueOnMount: `Übernimmt defaultValue beim ersten Mount.`,
                            firesOnValueChange: `Feuert onValueChange beim Klick auf ein Item.`,
                            fullyControllable: `Ist vollständig steuerbar via value + onValueChange.`,
                            disabledNoSwitch: `Wechselt nicht zu einem deaktivierten Item.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegeln Indikator und Label; Pfeil-Navigation dreht sich, sodass Links/Rechts zum visuell benachbarten Item führen.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <RadioGroup> und <RadioGroupItem> akzeptieren.`
                    }
                }
            },
            slider: {
                default: {
                    title: `Einzelner Thumb`,
                    description: `Standard 0-100-Slider mit einem Thumb. value ist immer ein number[].`
                },
                range: {
                    title: `Range (zwei Thumbs)`,
                    description: `Ein Zwei-Eintrag-Array für einen Range-Slider; der zweite Thumb kann den ersten nicht kreuzen.`
                },
                disabled: {
                    title: `Deaktiviert`,
                    description: `disabled ignoriert Pointer + Tastatur; der Wrapper wird per opacity-60 abgedimmt.`
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
                        body: `<Slider> kapselt Radix Slider mit dem shadcn-Track/Thumb-Styling. Die Library rendert einen Thumb pro Eintrag in value / defaultValue.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `onValueChange feuert während des Ziehens; onValueCommit feuert einmal beim Loslassen.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Einzelner Thumb`,
                            description: `Kontrollierter Single-Thumb-Slider.`
                        },
                        range: {
                            title: `Range (zwei Thumbs)`,
                            description: `Kontrollierter Range-Slider.`
                        },
                        disabled: {
                            title: `Deaktiviert`,
                            description: `Inaktiver Slider.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Slider> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            singleThumbDefault: `Rendert standardmäßig einen einzigen Thumb.`,
                            thumbsFromDefaultValue: `Rendert einen Thumb pro Eintrag in defaultValue.`,
                            thumbsFromControlledValue: `Rendert einen Thumb pro Eintrag im kontrollierten value.`,
                            forwardsMinMax: `Reicht min / max an den darunterliegenden Slider durch (aria-valuemin / aria-valuemax).`,
                            defaultRange: `Verwendet 0-100 als Standardbereich.`,
                            disabledForwards: `disabled wird an die Thumbs durchgereicht (data-disabled).`,
                            classNameMerge: `Merged ein eigenes className mit den Basis-Klassen.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" dreht sich die Slider-Richtung: Ziehen nach rechts senkt den Wert.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Slider> akzeptiert.`
                    }
                }
            },
            contextMenu: {
                default: {
                    title: `Rechtsklick-Ziel`,
                    description: `Rechtsklick irgendwo in der gestrichelten Fläche öffnet ein region-spezifisches Kontextmenü. Mit Escape oder Klick außerhalb schließen.`
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
                        body: `<ContextMenu> ist das lokale, Radix-getriebene Kontextmenü. Kombiniere mit <ContextMenuTrigger>, <ContextMenuContent>, <ContextMenuItem> und <ContextMenuSeparator>.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `ContextMenu für regionale Menüs ohne ActionManager-Beteiligung verwenden. Für globale, action-scope-getriebene Menüs <GlobalContextMenu> verwenden.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Rechtsklick-Ziel`,
                            description: `Rechtsklicke die gestrichelte Fläche, um das Menü zu öffnen.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <ContextMenu> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            closedByDefault: `Ist standardmäßig geschlossen — keine Menü-Items werden gerendert.`,
                            opensOnContextmenu: `Öffnet sich beim contextmenu-Event auf dem Trigger.`,
                            firesOnSelect: `Feuert onSelect beim Klick auf ein Item.`,
                            disabledIgnored: `Deaktivierte Items setzen data-disabled und ignorieren Auswahl.`,
                            closesOnSelect: `Schließt sich, wenn ein aktives Item ausgewählt wird.`,
                            separator: `Rendert einen Separator zwischen Item-Gruppen.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegeln die Menü-Items; das Menü verankert weiterhin am Cursor.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <ContextMenu> und <ContextMenuItem> akzeptieren.`
                    }
                }
            },
            dropdownMenu: {
                default: {
                    title: `Standard`,
                    description: `Der Trigger-Button öffnet ein Menü mit Label, Separator und drei Items.`
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
                        body: `<DropdownMenu> kapselt Radix DropdownMenu. Kombiniere mit Trigger, Content, Label, Separator und Item.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Beim Auswählen eines Items schließt das Menü standardmäßig. event.preventDefault() in onSelect hält das Menü offen (z. B. für Checkbox-artige Items, die externen State togglen).`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Standard`,
                            description: `Account-Menü mit Icons.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <DropdownMenu> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            closedByDefault: `Ist standardmäßig geschlossen — keine Menü-Items werden gerendert.`,
                            opensOnTrigger: `Öffnet sich beim Klick auf den Trigger.`,
                            firesOnSelectAndCloses: `Feuert onSelect beim Klick auf ein Item und schließt das Menü.`,
                            disabledData: `Deaktivierte Items setzen data-disabled.`,
                            closesOnEscape: `Schließt sich bei Escape.`,
                            labelNotMenuitem: `Das Label ist kein menuitem — es ist aus der Tastatur-Navigation ausgeschlossen.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegelt das Menü, sodass es am führenden Rand des Triggers öffnet.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <DropdownMenu> und <DropdownMenuItem> akzeptieren.`
                    }
                }
            },
            hoverCard: {
                default: {
                    title: `Username-Vorschau`,
                    description: `Hover (oder Fokus) auf den Link zeigt eine Vorschau. Open-/Close-Delays sind am Root einstellbar.`
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
                        body: `<HoverCard> kapselt Radix HoverCard. Öffnet bei Hover oder Fokus auf den Trigger; tastatur-zugänglich.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Open-/Close-Delay am Root tunen. Der Trigger sollte ein Link / Button sein (die Card ist informativ, nicht handlungsaufrufend).`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Username-Vorschau`,
                            description: `Hover über @mows zeigt die Vorschau.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <HoverCard> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            closedByDefault: `Ist standardmäßig geschlossen — Inhalt wird nicht gerendert.`,
                            defaultOpenRenders: `Rendert den Inhalt, wenn defaultOpen gesetzt ist.`,
                            contentStyling: `Wendet Breite + Popover-Hintergrund auf die Content-Oberfläche an.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegelt die Card, sodass sie am führenden Rand des Triggers öffnet.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <HoverCard> und <HoverCardContent> akzeptieren.`
                    }
                }
            },
            select: {
                default: {
                    title: `Kontrollierte Auswahl`,
                    description: `Klick auf den Trigger öffnet die Listbox. value + onValueChange treiben den kontrollierten Zustand.`
                },
                disabledOption: {
                    title: `Option deaktiviert`,
                    description: `Ein einzelnes <SelectItem disabled> aus der Auswahl ausschließen.`
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
                        body: `<Select> kapselt Radix Select. Kombiniere mit <SelectTrigger>+<SelectValue> für den Trigger und <SelectContent>+<SelectItem> für die Listbox.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Jedes <SelectItem value> muss in der Listbox eindeutig sein. value + onValueChange für externe Steuerung des aktiven Items.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Kontrollierte Auswahl`,
                            description: `Drei Items mit kontrolliertem Zustand.`
                        },
                        disabledOption: {
                            title: `Option deaktiviert`,
                            description: `Eine Option deaktiviert.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Select> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            placeholderWhenEmpty: `Rendert einen Combobox-Trigger mit Placeholder-Text, wenn leer.`,
                            reflectsDefaultValue: `Spiegelt defaultValue am Trigger.`,
                            fullyControllable: `Ist vollständig steuerbar via value + onValueChange.`,
                            firesOnExternalValueChange: `Der Trigger-Text folgt dem kontrollierten value, wenn er von außen geändert wird.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" wandert der Trigger-Pfeil an den führenden Rand; die Listbox richtet sich am Trigger aus.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Select> und <SelectItem> akzeptieren.`
                    }
                }
            },
            sonner: {
                default: {
                    title: `Toasts feuern`,
                    description: `Drei Buttons feuern einen Standard-, Erfolgs- und Fehler-Toast.`
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
                        body: `<Toaster> einmal nahe der Root mounten; Toasts von überall mit der toast()-Funktion aus sonner feuern.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `<Toaster> liest position standardmäßig aus MowsContext.toastSettings.position; ein position-Prop am Toaster überschreibt pro Mount.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Toasts feuern`,
                            description: `Default / Success / Error.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Toaster> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            contextTopLeft: `Liest position aus MowsContext (top-left).`,
                            contextBottomCenter: `Liest position aus MowsContext (bottom-center).`,
                            propOverrides: `Ein explizites position-Prop überschreibt den Context.`,
                            noProvider: `Rendert ohne <MowsProvider>, ohne zu werfen.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegelt das Toast-Layout, sodass der Action-Button am führenden Rand sitzt.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Toaster> akzeptiert.`
                    }
                }
            },
            inputGroup: {
                default: {
                    title: `Führendes Icon`,
                    description: `Ein <InputGroupAddon> vor dem Input wirkt wie ein führendes Icon. Klick auf das Addon fokussiert das Input.`
                },
                trailingAddon: {
                    title: `Nachgestelltes Addon`,
                    description: `Nachgestellte Addons (z. B. Währungs-Code) mit align="inline-end" auf dem Addon — order-last verschiebt es ans Ende der Flex-Zeile.`
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
                        body: `<InputGroup> kombiniert <InputGroupAddon> und <InputGroupInput>. Addons können Icons, Buttons oder gestylter Text via <InputGroupButton> / <InputGroupText> sein.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Addon vor dem Input für führenden Inhalt, danach für nachgestellten — bei nachgestellten Addons align="inline-end" setzen.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Führendes Icon`,
                            description: `Such-Icon vor dem Input.`
                        },
                        trailingAddon: {
                            title: `Nachgestelltes Addon`,
                            description: `Numerisches Input + EUR-Suffix.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <InputGroup> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersGroup: `Rendert einen role="group"-Wrapper mit Input und führendem Addon.`,
                            focusOnAddonClick: `Fokussiert das innere Input beim Klick auf das Addon.`,
                            alignInlineEnd: `align="inline-end" platziert das Addon zuletzt (data-align-Attribut + order-last).`,
                            alignDefault: `Addon-align ist standardmäßig inline-start, wenn weggelassen.`,
                            forwardsAriaInvalid: `Reicht aria-invalid ans innere Input durch.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" wandert das führende Addon nach rechts vom Input; align="inline-end"-Addons folgen entsprechend.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <InputGroup> und <InputGroupAddon> akzeptieren.`
                    }
                }
            },
            resizable: {
                default: {
                    title: `Horizontal mit drei Panels`,
                    description: `Ziehe die Trennlinien, um zu skalieren. Doppelklick auf eine Trennlinie setzt alle Panels auf ihre deklarierte defaultSize zurück.`
                },
                vertical: {
                    title: `Vertikal mit Griff`,
                    description: `direction="vertical" legt die Panels von oben nach unten an. withHandle zeigt einen sichtbaren Griff-Indikator auf der Skalierungsleiste.`
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
                        body: `<ResizablePanelGroup> kapselt react-resizable-panels mit shadcn-Styling. Kombiniere mit <ResizablePanel> und <ResizableHandle>.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `defaultSize auf den relevanten Panels deklarieren — der Rest-Platz wird gleichmäßig auf undeklarierte Panels verteilt. Doppelklick auf eine Trennlinie setzt das Layout auf diese Defaults zurück.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Horizontal mit drei Panels`,
                            description: `25/50/25-Aufteilung mit zwei ziehbaren Trennlinien.`
                        },
                        vertical: {
                            title: `Vertikal mit Griff`,
                            description: `Oben/Unten-Panels mit sichtbarem Griff-Indikator.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <ResizablePanelGroup> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            everyPanelDeclared: `Liefert die deklarierten Größen zurück, wenn jedes Panel eine angibt.`,
                            fillsMissing: `Füllt fehlende Defaults mit dem gleichmäßig aufgeteilten Rest.`,
                            splitsAcrossMany: `Verteilt den Rest auf mehrere undeklarierte Panels.`,
                            returnsNullOnOverflow: `Liefert null zurück, wenn ein undeklariertes Panel einen negativen Rest brauchen würde.`,
                            returnsNullWhenEmpty: `Liefert null zurück, wenn keine Panels vorhanden sind.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegelt das horizontale Layout — das erste Panel sitzt rechts.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <ResizablePanelGroup>, <ResizablePanel> und <ResizableHandle> akzeptieren.`
                    }
                }
            },
            calendar: {
                default: {
                    title: `Einzeldatum-Picker`,
                    description: `mode="single" mit kontrolliertem selected + onSelect.`
                },
                disableFuture: {
                    title: `disableFuture`,
                    description: `Komfort für Geburtsdatum-Picker: jeder Tag nach heute ist deaktiviert.`
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
                        body: `<Calendar> kapselt react-day-picker mit shadcn-Styling. mode + selected + onSelect für den Standard-Fluss.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `disableFuture für „keine Zukunftsdaten"; captionLayout="dropdown" für klickbare Monat-/Jahr-Selektoren; disabled mit Matcher für beliebige deaktivierte Bereiche.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Einzeldatum-Picker`,
                            description: `Kontrollierte Einzelauswahl.`
                        },
                        disableFuture: {
                            title: `disableFuture`,
                            description: `Zukunftstage sind deaktiviert.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Calendar> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersGrid: `Rendert ein Tages-Grid für den sichtbaren Monat.`,
                            marksSelected: `Markiert den ausgewählten Tag via data-selected*-Attribute auf Zelle oder Button.`,
                            firesOnSelect: `Feuert onSelect, wenn der Nutzer einen Tag im single-Modus auswählt.`,
                            disableFutureDisables: `disableFuture deaktiviert jeden Tag nach heute.`,
                            navigatesMonths: `Wechselt zum nächsten Monat beim Klick auf den Nächster-Monat-Button.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegelt das Kalender-Grid; Wochentag-Header lesen rechts-nach-links.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Calendar> akzeptiert. Alle react-day-picker-Props werden ebenfalls durchgereicht.`
                    }
                }
            },
            compass: {
                default: {
                    title: `Slider-gesteuert`,
                    description: `Ziehe den Slider 0-360°; die Leiste scrollt, sodass der Mittelmarker beim aktuellen Bearing bleibt.`
                },
                markers: {
                    title: `Mit Wegpunkten`,
                    description: `markers={[{ bearing, label }]} beschriftet zusätzliche Bearings auf der Leiste.`
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
                        body: `<Compass> ist eine HUD-artige horizontale Kompass-Leiste. heading aus beliebiger yaw-Quelle treiben — Image360Viewer onHeadingChange, 3D-Controller, Fahrzeug-Telemetrie usw.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `fieldOfView für den Zoom, tickInterval für den Tick-Abstand, markers für zusätzliche Bearings. Negative oder > 360°-Werte werden automatisch normalisiert.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Slider-gesteuert`,
                            description: `Leiste folgt einem 0-360°-Slider.`
                        },
                        markers: {
                            title: `Mit Wegpunkten`,
                            description: `Zwei zusätzliche beschriftete Bearings.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Compass> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            defaultReadout: `Rendert den Default-Readout als Ganzgrad + Himmelsrichtung.`,
                            normalisesNegative: `Normalisiert ein negatives heading auf 0-359°.`,
                            normalisesLarge: `Normalisiert ein heading > 360°.`,
                            mapsCardinal: `Mappt Headings nahe einer Himmelsrichtung auf diese.`,
                            cardinalsByDefault: `Rendert standardmäßig Himmelsrichtungs-Labels (N / E / S / W).`,
                            readoutNullHides: `Blendet den Readout aus, wenn readout={null}.`,
                            customReadout: `Akzeptiert einen eigenen Readout-Knoten.`,
                            rendersMarkers: `Rendert zusätzliche Marker aus dem markers-Prop.`,
                            hideCardinals: `hideCardinals entfernt die Default-Himmelsrichtungs-Labels von der Leiste.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Die Leiste scrollt horizontal unabhängig von der Schreibrichtung. Der numerische Readout folgt der Schreibrichtung.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Compass> akzeptiert.`
                    }
                }
            },
            avatar: {
                default: {
                    title: `Initialen`,
                    description: `Der erste Buchstabe von displayName, großgeschrieben, in einem runden Outline.`
                },
                loading: {
                    title: `Ladezustand`,
                    description: `Ohne displayName rendert der Avatar einen Skeleton-Platzhalter — sinnvoll, während die Auth noch lädt.`
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
                        body: `<Avatar> rendert den groß geschriebenen ersten Buchstaben von displayName in einem Kreis. displayName weglassen für einen Skeleton-Platzhalter.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Über className Größenvarianten setzen (z. B. h-7 w-7 text-xs für einen Inline-Trigger, h-16 w-16 text-xl für eine Profil-Headline).`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Initialen`,
                            description: `Vier Avatare — drei mit Namen, einer im Lade-Zustand.`
                        },
                        loading: {
                            title: `Ladezustand`,
                            description: `Einzelner Platzhalter, während die Auth lädt.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <Avatar> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            uppercasedInitial: `Zeigt den groß geschriebenen ersten Buchstaben von displayName.`,
                            unicodeInitial: `Akzeptiert Nicht-ASCII-Anfangsbuchstaben (ü, é, ñ …).`,
                            skeletonWhenMissing: `Rendert den Skeleton-Platzhalter, wenn displayName weggelassen wird.`,
                            skeletonWhenEmpty: `Rendert den Skeleton-Platzhalter, wenn displayName der leere String ist.`,
                            classNameMerge: `Merged className auf den äußeren Wrapper, ohne den Kreis-Outline zu verlieren.`,
                            styleForwards: `Reicht inline style an den Wrapper durch.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Der Avatar ist richtungsneutral — die runde Initialen-Darstellung liest sich in jeder Schreibrichtung gleich.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <Avatar> akzeptiert.`
                    }
                }
            },
            actionDisplay: {
                default: {
                    title: `Registrierte Aktion`,
                    description: `Liest die Greet-Action vom umgebenden ActionManager und rendert Label + Icon + gebundene Hotkeys.`
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
                        body: `<ActionDisplay> rendert eine einzelne Action — übersetztes Label, optionales Icon und gebundene Hotkeys. Action aus dem umgebenden actionManager holen.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Action-Handler können in ihrem State eine eigene component() liefern, die den gerenderten Inhalt vollständig überschreibt.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Registrierte Aktion`,
                            description: `Greet + Tastenkürzel.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <ActionDisplay> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            translatesLabel: `Rendert das Action-Label aus MowsContext.t.actions[id].`,
                            fallsBackToId: `Fällt auf die Action-ID zurück, wenn keine Übersetzung registriert ist.`,
                            rendersIcon: `Rendert das vom Action-State zurückgegebene Icon.`,
                            exposesDisabledReason: `Exponiert disabledReasonText via title-Attribut.`,
                            rendersHotkeys: `Rendert ein KeyComboDisplay pro registriertem Hotkey.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegeln Label und nachfolgende Hotkey-Reihe um das Icon.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <ActionDisplay> akzeptiert.`
                    }
                }
            },
            keyComboDisplay: {
                default: {
                    title: `Häufige Kombinationen`,
                    description: `Jede Kombination rendert ein <kbd> pro Segment; universelle Tasten (Enter, Pfeile, …) als Lucide-Icons.`
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
                        body: `<KeyComboDisplay> nimmt einen "+"-separierten Combo-String und rendert gestylte Keycaps. "mod" wird auf Mac zu ⌘, sonst Strg.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Universelle-Icon-Tasten (Enter, Tab, Pfeile, …) rendern immer als Icon. Modifier-Tasten als Mac-Glyphen (⌘ / ⌃ / ⌥) auf Apple, als übersetzte Wörter sonst.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Häufige Kombinationen`,
                            description: `mod+k, mod+shift+p, alt+enter, escape, shift+arrowup.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <KeyComboDisplay> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            eachSegmentKbd: `Jedes Segment rendert in einem eigenen <kbd>.`,
                            alphaUppercased: `Rendert Buchstaben großgeschrieben.`,
                            modifiersTranslated: `Rendert Modifier auf Nicht-Mac als übersetzte Wörter.`,
                            iconForUniversal: `Rendert universelle Tasten (z. B. Enter) als Icon.`,
                            arrowupIcon: `Rendert arrowup als Icon, nicht als Text.`,
                            plusSeparator: `Trennt zusammengesetzte Kombinationen mit einem "+" zwischen den kbds.`,
                            escapeWord: `Rendert escape als übersetztes Wort.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" spiegelt die kbd-Sequenz; der erste Key liegt rechts.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <KeyComboDisplay> akzeptiert.`
                    }
                }
            },
            keyboardShortcutEditor: {
                default: {
                    title: `Kürzel bearbeiten`,
                    description: `Listet jede beim ActionManager registrierte Action mit ihren aktuellen Tastenkombinationen. Über das Suchfeld filtern.`
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
                        body: `Innerhalb von <MowsProvider> mounten. Der Editor liest jede registrierte Action vom actionManager und erlaubt das Neubelegen über einen Aufnahme-Dialog.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Bindings werden via HotkeyManager im localStorage gesichert. Zurücksetzen stellt die defaultHotkeys wieder her; das Mülleimer-Icon löscht ein Binding.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Kürzel bearbeiten`,
                            description: `Live-Editor im Beispiel.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <KeyboardShortcutEditor> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            listsActions: `Listet jede registrierte Action.`,
                            rendersCurrentCombos: `Rendert die aktuell gebundenen Tastenkombinationen pro Action.`,
                            filtersBySearch: `Filtert die Action-Liste anhand der getippten Suchanfrage.`,
                            emptyStateOnNoMatches: `Zeigt keine Einträge, wenn keine Action zur Suche passt.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Action-Labels und Tastenkürzel-Spalten spiegeln unter dir="rtl".`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <KeyboardShortcutEditor> akzeptiert.`
                    }
                }
            },
            expandableCode: {
                default: {
                    title: `Langer Snippet`,
                    description: `Ein Snippet höher als 280px rendert hinter einem Gradient-Fade mit einem Expand-Button darunter.`
                },
                short: {
                    title: `Kurzer Snippet`,
                    description: `Inhalt kürzer als collapsedHeight rendert wie er ist — kein Knopf.`
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
                        body: `<ExpandableCode> umschließt beliebigen Inhalt (typisch <CodeViewer fitContent />) mit einem einklappbaren Container. Unterhalb von collapsedHeight rendert kein Knopf.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `Mit <CodeViewer fitContent /> kombinieren, damit der innere Editor seine natürliche Höhe meldet. ExpandableCode dimensioniert den Wrapper entsprechend.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Langer Snippet`,
                            description: `40 Zeilen hinter dem Gradient geclippt.`
                        },
                        short: {
                            title: `Kurzer Snippet`,
                            description: `Kein Expand-Button — Inhalt passt.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <ExpandableCode> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            rendersChildren: `Rendert die children unverändert.`,
                            noButtonWhenFits: `Blendet den Expand-Button aus, wenn der Inhalt in collapsedHeight passt.`,
                            buttonWhenOverflow: `Zeigt den Expand-Button, wenn der Inhalt collapsedHeight überschreitet.`,
                            togglesLabels: `Wechselt zwischen Expand- und Collapse-Label.`,
                            defaultExpanded: `Respektiert defaultExpanded.`,
                            labelOverrides: `Respektiert expandLabel- und collapseLabel-Overrides.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Richtungsneutral — die Affordanz-Reihe bleibt unter dir="rtl" zentriert.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <ExpandableCode> akzeptiert.`
                    }
                }
            },
            searchInput: {
                default: {
                    title: `Mit Clear-Button`,
                    description: `Tippen lässt den Clear-Button erscheinen; Hover oder Fokus zeigen ihn an.`
                },
                hideIcon: {
                    title: `Ohne führendes Icon`,
                    description: `hideIcon entfernt das führende Such-Icon — sinnvoll, wenn die umgebende Chrome bereits eines anzeigt.`
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
                        body: `<SearchInput> ist ein dünner Wrapper über <InputGroup>, der führendes Such-Icon, Clear-Button und Password-Manager-freundliche Autocomplete-Hinweise verdrahtet.`
                    },
                    composition: {
                        title: `Komposition`,
                        body: `hideIcon entfernt das führende Icon; hideClearButton entfernt den Clear-Button.`
                    },
                    examples: {
                        title: `Beispiele`,
                        default: {
                            title: `Mit Clear-Button`,
                            description: `Default-Styling — Icon + Input + Clear.`
                        },
                        hideIcon: {
                            title: `Ohne führendes Icon`,
                            description: `Icon unterdrückt.`
                        }
                    },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`,
                        intro: `Aussagen darüber, wie sich <SearchInput> verhalten soll, jeweils mit Verweis auf den Test.`,
                        verifiedBy: `geprüft durch`,
                        statements: {
                            typeSearch: `Rendert ein type="search"-Input.`,
                            leadingIcon: `Rendert standardmäßig ein führendes Such-Icon.`,
                            hideIcon: `hideIcon entfernt das führende Addon.`,
                            firesOnValueChange: `Feuert onValueChange beim Tippen.`,
                            showsClearWhenNonEmpty: `Zeigt den Clear-Button, sobald der Wert nicht-leer ist.`,
                            clearResetsValue: `Klick auf den Clear-Button setzt den Wert auf "" zurück.`,
                            hideClearButton: `hideClearButton unterdrückt den Clear-Button selbst bei Wert.`,
                            disabledForwards: `disabled wird sowohl an das Input als auch an den Clear-Button durchgereicht.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" wechselt das führende Icon nach rechts und der Clear-Button nach links.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <SearchInput> akzeptiert.`
                    }
                }
            },
            numberInput: {
                default: { title: `Ganzzahl mit Stepper`, description: `Klemmt auf [0, 64] mit step=1. Die − / + Buttons deaktivieren bei min/max.` },
                decimal: { title: `Dezimalwert`, description: `integerOnly={false} akzeptiert Dezimalwerte; step=0.1 steuert den Schritt.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<NumberInput> ist ein kontrolliertes numerisches Input mit Inline-Stepper-Buttons und min/max/step-Klemmung. Leerer Wert wird als null durchgereicht.` },
                    composition: { title: `Komposition`, body: `Über placeholder „was bei leer verwendet wird" kommunizieren. integerOnly={false} für Dezimalwerte; hideStepper entfernt die − / + Buttons.` },
                    examples: { title: `Beispiele`, default: { title: `Ganzzahl mit Stepper`, description: `0-64 vCPUs, step=1.` }, decimal: { title: `Dezimalwert`, description: `0.1-10 GiB, step=0.1.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <NumberInput> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            rendersValue: `Rendert ein Input mit dem kontrollierten Wert.`,
                            nullRendersEmpty: `Rendert leer, wenn value null ist.`,
                            clearEmitsNull: `Feuert onChange mit null, wenn das Feld geleert wird.`,
                            bumpsByStepPlus: `Erhöht um step beim Klick auf +.`,
                            bumpsByStepMinus: `Verringert um step beim Klick auf −.`,
                            clampsToMin: `Klemmt auf min beim − .`,
                            clampsToMax: `Klemmt auf max beim + .`,
                            clampOnBlur: `Klemmt einen out-of-range-Wert beim Blur.`,
                            hideStepper: `hideStepper entfernt die +/- Buttons.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Unter dir="rtl" bleiben die Stepper-Buttons am nachfolgenden Rand des Inputs.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <NumberInput> akzeptiert.` }
                }
            },
            colorCurves: {
                photo: {
                    title: `Foto-Kurven`,
                    description: `Lightroom-artige Tonwertkurven auf ein echtes Foto angewendet. Die Histogramm-Backdrop wird aus den Pixeln berechnet; Punkte ziehen zum Umfärben, Nicht-Endpunkte zum Löschen aus der Fläche schieben.`
                },
                standalone: {
                    title: `Editor alleinstehend`,
                    description: `Der Editor ohne angeschlossenes Canvas — nützlich, wenn die Kurven als Preset gespeichert oder an eine serverseitige Pipeline geschickt werden.`
                },
                photoLabels: {
                    channelHint: `Die Tabs oben wechseln den aktiven Kanal: zusammengesetzt RGB, dann R / G / B.`,
                    addPointHint: `Klicke auf die Fläche, um einen Kontrollpunkt hinzuzufügen.`,
                    deletePointHint: `Ziehe einen Nicht-Endpunkt aus der Fläche oder fokussiere ihn und drücke Entf, um ihn zu entfernen.`,
                    keyboardHint: `Punkt fokussieren und mit Pfeiltasten verschieben (Shift = grob).`,
                    loading: `Foto wird geladen…`,
                    photoLabel: `Foto:`,
                    byLabel: `von`
                },
                componentStrings: {
                    channelRgb: `RGB`,
                    channelRed: `R`,
                    channelGreen: `G`,
                    channelBlue: `B`,
                    resetChannel: `Kanal zurücksetzen`,
                    resetAll: `Alle zurücksetzen`,
                    editorAriaLabel: `Farbkurven-Editor`
                },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<ColorCurves> ist ein kontrollierter, kanalbasierter Tonwertkurven-Editor. Er liefert pro Kanal ein Array von Kontrollpunkten; das Ergebnis durch applyColorCurvesToImageData() gegen ein Canvas schicken, um Pixel zu transformieren.` },
                    composition: { title: `Komposition`, body: `<ColorCurves> mit einem <canvas> kombinieren für Live-Grading: Histogramm aus der ImageData mit computeColorCurvesHistogram() berechnen und Kurven bei jedem Change neu anwenden. Die Mathematik (buildCurveLUT, sampleCurve) ist für serverseitigen Einsatz exportiert.` },
                    examples: { title: `Beispiele`, photo: { title: `Foto-Kurven`, description: `Echtes Foto + Live-Histogramm + 4 Kanäle.` }, standalone: { title: `Editor alleinstehend`, description: `Nur Editor, ohne Canvas-Anbindung.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <ColorCurves> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            rendersSurface: `Rendert die SVG-Fläche zur Kurvenbearbeitung.`,
                            rendersChannelButtons: `Rendert einen Kanal-Tab pro RGB/R/G/B-Kanal.`,
                            channelClickSwitches: `Klick auf einen Kanal-Tab wechselt den aktiven Kanal.`,
                            resetChannelRestoresIdentity: `Kanal zurücksetzen stellt den aktiven Kanal auf die Identitätskurve zurück.`,
                            resetAllRestoresIdentity: `Alle zurücksetzen stellt jeden Kanal auf die Identitätskurve zurück.`,
                            clickAddsPoint: `Klick auf leere Fläche fügt einen Kontrollpunkt hinzu.`,
                            deleteRemovesPoint: `Entf-Taste auf einem fokussierten Nicht-Endpunkt entfernt diesen.`,
                            disabledPreventsInput: `disabled-Prop versteckt Pointer-Interaktion und deaktiviert die Action-Buttons.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Der Editor ist richtungsneutral — die x-Achse ist immer input-low → input-high. Texte in den Controls drehen sich unter dir="rtl".` },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <ColorCurves> akzeptiert.`,
                        props: {
                            value: `Pflicht. Eine Kurve pro Kanal — jede Kurve ist eine geordnete Liste von { x, y }-Kontrollpunkten mit Koordinaten in [0, 1].`,
                            onChange: `Pflicht. Wird mit dem neuen Wert nach jeder Bearbeitung, jedem Hinzufügen, Löschen oder Zurücksetzen aufgerufen.`,
                            channel: `Extern gesteuerter aktiver Kanal. Wenn weggelassen, verwaltet die Komponente die Auswahl intern.`,
                            onChannelChange: `Wird ausgelöst, wenn ein Kanal-Tab ausgewählt wird.`,
                            histogram: `Optionales Histogramm mit 256 Bins, das hinter der Kurve gezeichnet wird. Mit computeColorCurvesHistogram(imageData) aus einem Canvas erzeugen.`,
                            showHistogram: `Schaltet das Histogramm im Hintergrund ein/aus. Wirkt nur, wenn ein Histogramm übergeben wurde.`,
                            size: `Kantenlänge der quadratischen Zeichenfläche in SVG-viewBox-Einheiten.`,
                            disabled: `Deaktiviert Pointer-Interaktion, Fokus und die Action-Buttons.`,
                            hideResetAll: `Versteckt den „Alle zurücksetzen"-Button, wenn nur pro Kanal zurückgesetzt werden soll.`,
                            strings: `Übersetzte Beschriftungen für die Kanal-Tabs, Reset-Buttons und ARIA-Strings. Fehlende Schlüssel fallen auf die englischen Defaults zurück.`,
                            ariaLabel: `Zugängliche Beschriftung für den Editor-Container.`
                        }
                    }
                }
            },
            optionPicker: {
                default: { title: `Multi-Select`, description: `Drei Optionen im Popover. Toggle hält das Menü offen; der Trigger zeigt „(enabled/total)" als Default.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<OptionPicker> ist ein Multi-Select-Dropdown auf Basis von DropdownMenuCheckboxItem. Optionen sind { id, label, enabled }; der Konsument togglet via onOptionChange.` },
                    composition: { title: `Komposition`, body: `triggerComponent für ein eigenes Trigger-Label. Das Menü schließt absichtlich NICHT beim Auswählen, damit man mehrere Optionen in einem Zug togglen kann.` },
                    examples: { title: `Beispiele`, default: { title: `Multi-Select`, description: `Drei Ansichts-Optionen.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <OptionPicker> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            rendersLabel: `Rendert das Trigger-Label.`,
                            showsCountByDefault: `Rendert standardmäßig die enabled/total-Anzeige am Trigger.`,
                            hidesCountWhenFalse: `Lässt die Anzeige weg, wenn showCount={false}.`,
                            menuItemsAfterOpen: `Rendert ein menuitemcheckbox pro Option nach dem Öffnen.`,
                            firesOnToggle: `Feuert onOptionChange beim Toggle eines Eintrags.`,
                            staysOpenOnToggle: `Bleibt nach dem Toggle offen (preventDefault auf onSelect).`,
                            rendersHeader: `Rendert das optionale Header-Label.`,
                            disabledForwards: `Deaktivierter Trigger reicht disabled durch und ignoriert Klicks.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Unter dir="rtl" spiegelt das Menü und öffnet am führenden Rand.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <OptionPicker> akzeptiert.` }
                }
            },
            searchSelectPicker: {
                standalone: { title: `Eigenständig`, description: `Inline-Suchliste — kein Popover-Trigger. Tippen zum Filtern, Klick zum Auswählen.` },
                popover: { title: `Popover-Trigger`, description: `Standardform — der Picker lebt hinter einem Popover-Trigger.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<SearchSelectPicker> ist ein generischer Such-Single-Select. Er nimmt items + getId + matchesSearch + renderItemContent und funktioniert im Popover- und Standalone-Modus.` },
                    composition: { title: `Komposition`, body: `<LanguagePicker>, <ThemePicker> und <CodeThemePicker> sind dünne Wrapper über <SearchSelectPicker>, die items + selected + matchers aus MowsProvider beziehen.` },
                    examples: { title: `Beispiele`, standalone: { title: `Eigenständig`, description: `Inline-Liste mit fünf Items.` }, popover: { title: `Popover-Trigger`, description: `Drei Items hinter einem Popover.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <SearchSelectPicker> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            rendersInlineList: `Rendert jedes Item inline im Standalone-Modus.`,
                            filtersBySearch: `Filtert Items per Suche im Standalone-Modus.`,
                            emptyTextOnNoMatches: `Zeigt den emptyText-Fallback, wenn die Suche nichts trifft.`,
                            firesOnSelect: `Feuert onSelect mit dem gewählten Item im Standalone-Modus.`,
                            fullyControllable: `Ist vollständig steuerbar via selected + onSelect.`,
                            popoverTriggerOpens: `Im Popover-Modus rendert er einen Trigger, der die Suchliste öffnet.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Unter dir="rtl" spiegeln Suchinput + Liste; die Auswahlmarkierung dreht sich entsprechend.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <SearchSelectPicker> akzeptiert. Generisch in T — Item-Typ beim Verwenden übergeben.` }
                }
            },
            languagePicker: {
                popover: { title: `Popover-Trigger`, description: `Standardform — der Picker lebt hinter einem Popover.` },
                standalone: { title: `Eigenständig`, description: `Suchliste inline, ohne Popover.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<LanguagePicker> innerhalb von <MowsProvider> mounten. Er liest die verfügbaren Sprachen und die aktuelle Sprache aus dem Context und ruft setLanguage bei der Auswahl auf.` },
                    composition: { title: `Komposition`, body: `<LanguagePicker> ist ein dünner Wrapper um <SearchSelectPicker> mit auf { code, name, emoji } spezialisierten renderItemContent / renderTriggerContent.` },
                    examples: { title: `Beispiele`, popover: { title: `Popover-Trigger`, description: `Trigger + Popover-Liste.` }, standalone: { title: `Eigenständig`, description: `Inline-Suchliste.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <LanguagePicker> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            listsLanguages: `Listet jede Sprache im Standalone-Modus.`,
                            firesSetLanguage: `Ruft setLanguage im umgebenden Context auf, wenn eine Sprache gewählt wird.`,
                            popoverShowsCurrent: `Rendert den Popover-Trigger standardmäßig mit der aktuellen Sprache.`
                        }
                    },
                    rtl: { title: `RTL`, body: `In dir="rtl" eingewickelt drehen sich Trigger + Suchfeld nach rechts-nach-links.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <LanguagePicker> akzeptiert.` }
                }
            },
            themePicker: {
                popover: { title: `Popover-Trigger`, description: `Standardform — der Picker lebt hinter einem Popover.` },
                standalone: { title: `Eigenständig`, description: `Suchliste inline, ohne Popover.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<ThemePicker> innerhalb von <MowsProvider> mounten. Er liest die verfügbaren Themes und das aktive Theme aus dem Context und ruft setTheme bei der Auswahl auf.` },
                    composition: { title: `Komposition`, body: `<ThemePicker> ist ein dünner Wrapper um <SearchSelectPicker>. Der „system"-Eintrag zeigt in der Popover-Zeile die OS-aufgelöste Variante („(dark)" / „(light)").` },
                    examples: { title: `Beispiele`, popover: { title: `Popover-Trigger`, description: `Trigger + Popover-Liste.` }, standalone: { title: `Eigenständig`, description: `Inline-Suchliste.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <ThemePicker> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            listsThemes: `Listet jedes Theme im Standalone-Modus.`,
                            firesSetTheme: `Ruft setTheme im umgebenden Context auf, wenn ein Theme gewählt wird.`,
                            popoverShowsCurrent: `Rendert den Popover-Trigger standardmäßig mit dem aktuellen Theme.`
                        }
                    },
                    rtl: { title: `RTL`, body: `In dir="rtl" eingewickelt drehen sich Trigger + Suchfeld nach rechts-nach-links.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <ThemePicker> akzeptiert.` }
                }
            },
            mapStylePicker: {
                popover: { title: `Popover-Trigger`, description: `Standardform — der Picker lebt hinter einem Popover.` },
                standalone: { title: `Eigenständig`, description: `Suchliste inline, ohne Popover.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<MapStylePicker> innerhalb von <MowsProvider> mounten. Er liest mapStyles und currentMapStyle aus dem Context und ruft setMapStyle bei der Auswahl auf.` },
                    composition: { title: `Komposition`, body: `Eine Auswahl hier aktualisiert jede gemountete <Map>, die nicht ihre eigene mapStyle-Prop fixiert, und speichert den Stil unter storagePrefix_map_style in localStorage.` },
                    examples: { title: `Beispiele`, popover: { title: `Popover-Trigger`, description: `Trigger + Popover-Liste.` }, standalone: { title: `Eigenständig`, description: `Inline-Suchliste.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <MapStylePicker> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            listsStyles: `Listet jeden Kartenstil im Standalone-Modus.`,
                            firesSetMapStyle: `Ruft setMapStyle im umgebenden Context auf, wenn ein Stil gewählt wird.`,
                            popoverShowsCurrent: `Rendert den Popover-Trigger standardmäßig mit dem aktuellen Kartenstil.`
                        }
                    },
                    rtl: { title: `RTL`, body: `In dir="rtl" eingewickelt drehen sich Trigger + Suchfeld nach rechts-nach-links.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <MapStylePicker> akzeptiert.` }
                }
            },
            map: {
                default: { title: `Standard`, description: `Mapbox-gl-Viewport. Der aktive Stil folgt der Wahl im Einstellungs-Panel.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<Map> rendert einen mapbox-gl-Viewport. Sowohl mapbox-gl-JS als auch das zugehörige CSS werden beim ersten Mount lazy geladen, damit Konsumenten ohne Karte keine Bundle-Kosten zahlen.` },
                    composition: { title: `Komposition`, body: `Standardmäßig folgt <Map> dem currentMapStyle aus dem MowsContext, sodass das SettingsPanel den Stil app-weit umschalten kann. Über die mapStyle-Prop lässt sich das pro Instanz fixieren.` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Lebendiger mapbox-gl-Viewport im Welt-Zoom.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <Map> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            lazyLoadsMapbox: `Zeigt einen Lade-Skeleton, bis der mapbox-gl-Chunk geladen ist.`,
                            usesContextStyle: `Instanziiert mapbox-gl standardmäßig mit dem currentMapStyle aus dem Context.`,
                            propOverridesContext: `Eine explizite mapStyle-Prop überschreibt den Context-Wert.`,
                            appliesAccessToken: `Setzt das accessToken des aktiven Stils vor der Instanziierung.`,
                            reactsToContextChange: `Ruft setStyle, wenn sich der aktive Kartenstil im Context ändert.`,
                            firesOnLoad: `Feuert onLoad, sobald die Karte das "load"-Event sendet.`,
                            cleansUpOnUnmount: `Ruft beim Unmount map.remove() auf.`
                        }
                    },
                    rtl: { title: `RTL`, body: `mapbox-gl rendert sein eigenes Canvas; <Map> ergänzt keine richtungsabhängige UI, dir="rtl" lässt den Viewport unverändert.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <Map> akzeptiert.` }
                }
            },
            locationPicker: {
                default: { title: `Standard`, description: `Beliebige Stelle auf der Karte anklicken, um eine Koordinate zu wählen; der gewählte Wert erscheint unterhalb des Canvas.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<LocationPicker> wickelt <Map> ein und macht aus einem Klick einen einzelnen Punkt. value + onChange für kontrollierte Formulare, defaultValue für unkontrolliert.` },
                    composition: { title: `Komposition`, body: `LocationPicker übernimmt currentMapStyle aus dem MowsContext, sodass der SettingsPanel-MapStylePicker die Kacheln auch hier steuert. Löschen über den Inline-Button oder value=null.` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Klick-to-Pin-Koordinatenwähler.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <LocationPicker> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            rendersMap: `Rendert eine eingebettete Karte mit Hinweistext, bis der Nutzer klickt.`,
                            uncontrolledClickUpdates: `Im unkontrollierten Modus aktualisiert ein Klick den internen Wert und zeigt das Ergebnis.`,
                            controlledFiresOnChange: `Im kontrollierten Modus feuert ein Klick onChange, lässt aber den sichtbaren Wert unverändert, bis der Parent value aktualisiert.`,
                            clearResets: `Der Lösch-Button setzt den gewählten Wert auf null zurück.`,
                            mountsMarker: `Setzt einen themengestylten Pin auf die Karte, sobald der erste Wert gesetzt ist.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Das Karten-Canvas ist richtungsneutral; nur die Anzeige darunter spiegelt in dir="rtl".` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <LocationPicker> akzeptiert.` }
                }
            },
            dateTimePicker: {
                default: { title: `Standard`, description: `Ein Textfeld + Popover-Kalender + Time-Picker.` },
                withTimezone: { title: `Mit Zeitzone`, description: `showTimezone fügt einen IANA-Timezone-Selektor im Popover hinzu.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<DateTimePicker> verdrahtet ein Textfeld mit einem Popover (Kalender + Time-Picker). value + onChange für kontrolliert, defaultValue für unkontrolliert.` },
                    composition: { title: `Komposition`, body: `showSeconds für eine Sekunden-Spalte; showTimezone für den Timezone-Selektor; disableFuture, um Daten nach heute zu blocken (DOB-Picker).` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Textfeld + Kalender + Time-Picker.` }, withTimezone: { title: `Mit Zeitzone`, description: `Inklusive Timezone-Selektor.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <DateTimePicker> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            rendersTextInput: `Rendert ein Date+Time-Textfeld.`,
                            seedsFromDefault: `Übernimmt defaultValue als Startwert.`,
                            reflectsControlled: `Spiegelt ein kontrolliertes value-Prop.`,
                            firesOnConfirm: `Feuert onChange beim Bearbeiten + Bestätigen des Textfelds.`,
                            disabledForwards: `Rendert disabled, wenn disabled gesetzt ist.`,
                            placeholderReflectsFormat: `Exponiert einen Placeholder, der timeFormat / showSeconds spiegelt.`,
                            showsTimezoneSelector: `Zeigt den Timezone-Selektor, wenn showTimezone gesetzt ist.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Unter dir="rtl" spiegelt der Kalender-Header / Time-Picker.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <DateTimePicker> akzeptiert.` }
                }
            },
            timePicker: {
                default: { title: `24h + Sekunden`, description: `Drei Scroll-Spalten: Stunden, Minuten, Sekunden.` },
                twelveHour: { title: `12h mit AM/PM`, description: `12h-Layout ergänzt eine AM/PM-Spalte.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<TimePicker> ist die innere Spalten-basierte Time-Auswahl in <DateTimePicker>. Über Date + onChange treiben; die Spalten sind vertikal scrollbare Listen.` },
                    composition: { title: `Komposition`, body: `12h: 12 Stunden-Einträge + AM/PM-Spalte; 24h: 24 Einträge. showSeconds togglet die Sekunden-Spalte.` },
                    examples: { title: `Beispiele`, default: { title: `24h + Sekunden`, description: `Drei Spalten.` }, twelveHour: { title: `12h mit AM/PM`, description: `Stunde + Minute + AM/PM-Spalte.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <TimePicker> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            rendersColumns24h: `Rendert im 24h-Modus eine Stunden- und eine Minuten-Spalte.`,
                            secondsColumn: `Rendert eine Sekunden-Spalte, wenn showSeconds gesetzt ist.`,
                            firesOnHourPick: `Feuert onChange mit einem neuen Date beim Klick auf eine Stunden-Zelle.`,
                            fullyControllable: `Ist vollständig steuerbar via date + onChange.`,
                            amPmColumn: `Rendert im 12h-Modus eine AM/PM-Spalte.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Unter dir="rtl" dreht sich die Spaltenreihenfolge, sodass Stunden rechts liegen.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <TimePicker> akzeptiert.` }
                }
            },
            timezoneSelector: {
                default: { title: `Standard`, description: `Ein Combobox-artiger Trigger, der eine suchbare IANA-Timezone-Liste öffnet.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<TimezoneSelector> kapselt Radix Popover + cmdk Command, um jede IANA-Timezone mit Offset-Info anzuzeigen. value / onChange nutzen die kanonische IANA-ID.` },
                    composition: { title: `Komposition`, body: `Standalone für explizite „Log-Timezone"-Picker, und innerhalb <DateTimePicker>, wenn showTimezone gesetzt ist.` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Suchbarer Timezone-Picker.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <TimezoneSelector> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            rendersTrigger: `Rendert den Trigger-Button.`,
                            showsSelected: `Zeigt die ausgewählte Timezone am Trigger.`,
                            opensSearch: `Öffnet beim Klick eine Suchliste.`,
                            firesOnChange: `Feuert onChange, wenn der Nutzer eine Timezone auswählt.`,
                            fullyControllable: `Ist vollständig steuerbar via value + onChange.`,
                            disabledNoOpen: `Disabled verhindert das Öffnen des Popovers.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Unter dir="rtl" spiegelt Trigger-Pfeil + Listbox.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <TimezoneSelector> akzeptiert.` }
                }
            },
            dateTimeRangePicker: {
                default: { title: `Standard`, description: `Zwei Date+Time-Inputs teilen sich ein Kalender-Popover. Tag klicken setzt Start; weiterer Klick setzt Ende. Endpunkte sind drag-bar.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<DateTimeRangePicker> bietet zwei Textfelder (Start / Ende) und ein gemeinsames Popover (Kalender + Time-Picker). range ist { from, to }.` },
                    composition: { title: `Komposition`, body: `showDuration zeigt die berechnete Dauer („5 days 6h 30m") im Popover; showTimezone fügt den Timezone-Selektor hinzu; timeLayout="beside" setzt Time-Picker neben den Kalender.` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Zwei Textfelder + gemeinsames Popover.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <DateTimeRangePicker> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            rendersBothInputs: `Rendert zwei Textfelder: Start und Ende.`,
                            reflectsFrom: `Spiegelt defaultValue.from im Start-Input.`,
                            reflectsTo: `Spiegelt defaultValue.to im End-Input.`,
                            fullyControllable: `Ist vollständig steuerbar via value + onChange.`,
                            disabledForwards: `Deaktiviert beide Inputs, wenn disabled gesetzt ist.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Unter dir="rtl" spiegelt die Input-Reihenfolge; der Kalender folgt der Schreibrichtung.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <DateTimeRangePicker> akzeptiert.` }
                }
            },
            loggingConfig: {
                default: { title: `Standard`, description: `Standard-Log-Level + Pro-Datei-Filter. Änderungen aktualisieren Logger.defaultLevel / Logger.fileFilter sofort.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Importpfade an dein Projekt an.` },
                    usage: { title: `Verwendung`, body: `<LoggingConfig> exponiert die globale Logger-Konfigurations-UI. Änderungen rufen Logger.saveConfig() auf, was in localStorage persistiert.` },
                    composition: { title: `Komposition`, body: `In die Settings-Seite oder ein Modal ablegen. Keine Props außer className.` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Vollständiges Logging-Settings-Panel.` } },
                    definedBehaviour: {
                        title: `Festgelegtes Verhalten`, intro: `Aussagen darüber, wie sich <LoggingConfig> verhalten soll, jeweils mit Verweis auf den Test.`, verifiedBy: `geprüft durch`,
                        statements: {
                            rendersDefaultLevel: `Rendert den Standard-Level-Abschnitt.`,
                            exposesFilterInput: `Bietet ein Input zum Anlegen eines Pro-Datei-Filters.`,
                            addsFilter: `Fügt einen Datei-Filter hinzu, wenn der Add-Button geklickt wird.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Das Sektionslayout spiegelt unter dir="rtl".` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <LoggingConfig> akzeptiert.` }
                }
            },
            inlineEdit: {
                basic: {
                    title: `Standard`,
                    description: `Klicke auf den Text oder das Stiftsymbol, um zu bearbeiten. Mit Enter oder dem grünen Haken übernimmst du den Wert, mit Escape oder dem roten X verwirfst du ihn.`
                },
                heading: {
                    title: `Überschrift`,
                    description: `Mit dem as-Prop rendert die bearbeitbare Fläche als <h2> (oder eine andere Überschrift) — der Inline-Bearbeitungsmodus bleibt erhalten.`
                },
                placeholder: {
                    title: `Platzhalter`,
                    description: `Bei leerem Wert wird der Platzhalter in gedämpfter Kursivschrift angezeigt, bis etwas getippt wird.`
                },
                fixedWidth: {
                    title: `Feste Breite`,
                    description: `Mit dem width-Prop wird das Eingabefeld auf eine feste CSS-Breite fixiert. Tippen über die Breite hinaus scrollt horizontal, statt die Zeile zu vergrößern.`
                },
                disabled: {
                    title: `Deaktiviert`,
                    description: `disabled blendet die Bearbeitungs-Buttons aus und stellt den Text statisch dar.`
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
                        body: `<InlineEdit> ist ein kontrolliertes Textfeld, das sich an Ort und Stelle bearbeiten lässt, ohne das umgebende Layout zu verändern. Statt eines <input> wird contentEditable verwendet, sodass Schriftmaße und Zeilenhöhe zwischen Anzeige- und Bearbeitungsmodus identisch bleiben.`
                    },
                    composition: {
                        title: `Zusammensetzung`,
                        body: `Die Aktionsleiste ist ein Grid mit zwei festen Slots. Die Buttons für Bearbeiten, Speichern und Abbrechen teilen sich diese Slots per Opazitäts-Wechsel — die Zeile behält im Ruhezustand, beim Hover und im Bearbeitungsmodus dieselbe Breite.`
                    },
                    examples: {
                        title: `Beispiele`,
                        basic: {
                            title: `Standard`,
                            description: `Eine kurze Zeichenkette inline umbenennen. Die Zeilenbreite ist vor, während und nach der Bearbeitung identisch.`
                        },
                        heading: {
                            title: `Überschrift`,
                            description: `Mit as wird die Bearbeitungsfläche als <h2> gerendert — nützlich für inline editierbare Seitentitel.`
                        },
                        placeholder: {
                            title: `Platzhalter`,
                            description: `Leere Werte zeigen den Platzhalter in gedämpfter Kursivschrift, bis Inhalt eingegeben wird.`
                        },
                        fixedWidth: {
                            title: `Feste Breite`,
                            description: `Ist das width-Prop gesetzt, behält das contentEditable-Element seine Größe beim Tippen bei. Der Überlauf wird abgeschnitten und der Cursor scrollt innerhalb der Box — die Zeilenbreite bleibt unverändert.`
                        },
                        disabled: {
                            title: `Deaktiviert`,
                            description: `Im deaktivierten Zustand werden die Buttons ausgeblendet und der Text statisch angezeigt. Die Zeilengeometrie entspricht weiterhin der bearbeitbaren Variante.`
                        }
                    },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`,
                        intro: `Aussagen darüber, wie sich <InlineEdit> verhalten soll — jeweils mit dem Test verlinkt, der sie verifiziert.`,
                        verifiedBy: `verifiziert durch`,
                        statements: {
                            rendersValue: `Zeigt den aktuellen Wert im Anzeigemodus an.`,
                            commitsOnEnter: `Enter beendet die Bearbeitung und ruft onCommit mit dem getrimmten Wert auf.`,
                            cancelsOnEscape: `Escape verlässt den Bearbeitungsmodus ohne onCommit aufzurufen und stellt den ursprünglichen Wert wieder her.`,
                            discardsUnchanged: `Leere oder unveränderte Werte werden stillschweigend verworfen — onCommit wird damit nie aufgerufen.`,
                            hidesButtonsWhenDisabled: `Im deaktivierten Zustand werden Bearbeiten-/Speichern-/Abbrechen-Buttons nicht gerendert.`,
                            stableAffordanceWidth: `Die Aktionsleiste hat eine feste Breite, sodass die Zeile beim Wechsel in/aus dem Bearbeitungsmodus nicht umbricht.`,
                            fixedWidthDoesNotGrow: `Ist width gesetzt, behält das Eingabefeld unabhängig vom eingegebenen Wert exakt diese Breite.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Unter dir="rtl" wandert die Aktionsleiste auf die linke Seite des Texts; die feste Slotbreite garantiert eine unveränderte Zeilenbreite.`
                    },
                    apiReference: {
                        title: `API-Referenz`,
                        intro: `Props, die <InlineEdit> akzeptiert.`
                    }
                }
            },
            commandPalette: {
                default: { title: `Standard`, description: `Wird über die registrierte Aktion geöffnet. Tippen filtert, Klick oder Eingabetaste löst die Aktion aus.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<CommandPalette> wird einmal global innerhalb von <MowsProvider> eingebunden. Sie registriert sich als Handler für CoreActionIds.OPEN_COMMAND_PALETTE und listet alle aktuell beim ActionManager registrierten Aktionen.` },
                    composition: { title: `Komposition`, body: `Öffnen via mowsContext.actionManager.dispatchAction(CoreActionIds.OPEN_COMMAND_PALETTE) oder per Tastenkombination über den HotkeyManager. open / onOpenChange erlauben externes Steuern des Zustands.` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Klicke die Schaltfläche, um die Befehlspalette zu öffnen, und tippe, um die registrierten Aktionen zu filtern.` } },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich <CommandPalette> verhalten soll — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            closedByDefault: `Ist standardmäßig geschlossen — keine Listeneinträge gerendert.`,
                            opensOnControlled: `Öffnet sich, wenn die kontrollierte open-Prop auf true wechselt.`,
                            rendersActions: `Rendert eine Zeile pro registrierter Aktion.`,
                            filtersBySearch: `Filtert die Aktionsliste anhand der eingegebenen Suche.`,
                            dispatchesOnClick: `Löst die Aktion aus, wenn ein Eintrag geklickt wird.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Unter dir="rtl" werden Suchfeld und Befehlsliste gespiegelt.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <CommandPalette> akzeptiert.` }
                }
            },
            modalHandler: {
                default: { title: `Standard`, description: `Klicke eine Schaltfläche, um einen der Kern-Dialoge zu öffnen; ModalHandler liest MowsContext.currentlyOpenModal und rendert den passenden Dialog.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<ModalHandler> wird einmal global innerhalb von <MowsProvider> eingebunden. Er beobachtet currentlyOpenModal und rendert den passenden Kerndialog (Theme / Sprache / Tastenkürzel / Code-Theme / Einstellungen).` },
                    composition: { title: `Komposition`, body: `Registriere app-spezifische Dialoge über extraModals. Öffne jeden Modal mit mowsContext.changeActiveModal(id).` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Löse die Theme-, Sprach- und Tastenkürzel-Dialoge über den Action Manager aus.` } },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich <ModalHandler> verhalten soll — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            invisibleWhenNoModal: `Rendert nichts Sichtbares, wenn kein Modal aktiv ist.`,
                            themeSelector: `Rendert den Theme-Auswahl-Dialog bei modal=themeSelector.`,
                            languageSelector: `Rendert den Sprach-Auswahl-Dialog bei modal=languageSelector.`,
                            keyboardShortcutEditor: `Rendert den Tastenkürzel-Editor bei modal=keyboardShortcutEditor.`,
                            customModal: `Rendert einen über extraModals bereitgestellten, benutzerdefinierten Modal.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Der Dialoginhalt wird unter dir="rtl" gespiegelt.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <ModalHandler> akzeptiert.` }
                }
            },
            fileViewer: {
                default: { title: `Standard`, description: `Mitgeliefertes Landschaftsbild wird durch den ImageViewer gerendert. Vertausche URL, Name oder MIME-Typ, um andere Renderpfade zu testen.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<FileViewer> nimmt eine bereits aufgelöste src-URL plus name und mimeType entgegen und rendert den passenden internen Viewer. URL-Auflösung (Auth, signierte URLs etc.) ist Aufgabe des Konsumenten.` },
                    composition: { title: `Komposition`, body: `FileViewer wählt anhand des mimeType: image/* → ImageViewer (bzw. Image360Viewer, wenn is360 gesetzt ist); video/* sowie DASH-/HLS-Manifeste → VideoViewer. Unbekannte Typen fallen auf den Dateinamen oder einen eigenen Fallback zurück.` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Zeige ein mitgeliefertes Bild. Ändere eines der drei Felder, um verschiedene Renderpfade zu prüfen.` } },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich <FileViewer> verhalten soll — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            imageViewer: `Rendert ImageViewer für image/* ohne is360.`,
                            image360Viewer: `Rendert Image360Viewer für image/* wenn is360 gesetzt ist.`,
                            videoViewer: `Rendert VideoViewer für jeden video/*-MIME-Typ.`,
                            dashHls: `Rendert VideoViewer für DASH- und HLS-Manifest-MIME-Typen.`,
                            nameFallback: `Fällt auf den Namen zurück, wenn kein Viewer passt.`,
                            customFallback: `Rendert den explizit übergebenen Fallback, wenn nichts passt.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Innere Viewer folgen ihrem eigenen RTL-Verhalten; der Wrapper selbst ist layout-neutral.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <FileViewer> akzeptiert.` }
                }
            },
            image360Viewer: {
                default: { title: `Standard`, description: `Schlichter Image360Viewer mit einem einzelnen äquirektangulären Panorama — ziehen zum Umsehen, scrollen zum Zoomen.` },
                switchImages: {
                    title: `Bilder wechseln`,
                    description: `Zwei-Quellen-Umschalter, gesteuert durch Buttons unterhalb des Viewers. Jeder Klick aktualisiert die src-Prop; der Viewer nutzt seinen WebGL-Kontext per setPanorama weiter, statt neu zu mounten — das vorherige Bild bleibt sichtbar, bis die neue Textur geladen ist.`
                },
                compassOverlay: {
                    title: `Compass-Overlay`,
                    description: `Compass-Komponente absolut ÜBER dem Viewer positioniert (HUD-Stil) statt darunter, sodass die Richtungsanzeige beim Schwenken sichtbar bleibt.`
                },
                virtualTour: {
                    title: `Virtueller Rundgang`,
                    description: `Marker überlagern anklickbare Hotspots auf der Sphäre. Jeder Pin trägt eine data.target-Payload; onMarkerClick tauscht src und Marker-Set aus — das Muster für einen Szenenwechsel. Der türkise Punkt ist ein reiner Tooltip-Hotspot.`
                },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<Image360Viewer> umschließt Photo Sphere Viewer (three.js) mit shadcn-freundlichen Defaults: ausgeblendete Navbar, keine eigene Ladeanzeige und einen onHeadingChange-Callback für HUD-artige Yaw-Anzeigen.` },
                    composition: { title: `Komposition`, body: `Kombiniere mit <Compass> für eine Richtungsanzeige, die dem Blick folgt. Über die Props markers und onMarkerClick werden anklickbare Hotspots eingeblendet — gestützt auf das markers-plugin von Photo Sphere Viewer, das HTML-/Bild-/Polygon-Marker und Tooltips unterstützt. Beim Aktualisieren der markers-Prop wird das Live-Set per setMarkers diff-ausgetauscht — exakt das Muster, das ein virtueller Rundgang für Szenenwechsel braucht.` },
                    examples: {
                        title: `Beispiele`,
                        default: { title: `Standard`, description: `Schlichter Viewer, ohne Compass, ohne Marker.` },
                        switchImages: {
                            title: `Bilder wechseln`,
                            description: `Zwei Buttons tauschen die src zwischen Panoramen aus; der Viewer nutzt seinen WebGL-Kontext per setPanorama weiter.`
                        },
                        compassOverlay: {
                            title: `Compass-Overlay`,
                            description: `Compass per absoluter Positionierung über dem Viewer.`
                        },
                        virtualTour: {
                            title: `Virtueller Rundgang`,
                            description: `markers-plugin-Hotspots mit Klick-Navigation zwischen zwei Szenen.`
                        }
                    },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich <Image360Viewer> verhalten soll — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            mountsViewer: `Erzeugt einen Photo Sphere Viewer mit der angegebenen src.`,
                            subscribesPosition: `Abonniert das PSV-Event position-updated, um Heading-Änderungen weiterzuleiten.`,
                            noLoadingIndicator: `Zeigt während des Ladens des initialen Panoramas keine Ladeanzeige.`,
                            hardCutSwitch: `Blendet beim src-Wechsel sofort einen Skeleton über das alte Panorama und weist PSV an, das Crossfade zu überspringen — der Skeleton verschwindet, sobald die neue Textur bereit ist.`,
                            crossfadeOptIn: `crossfadeOnSwitch={true} überspringt den Skeleton und lässt PSV stattdessen zwischen den Panoramen blenden.`,
                            forwardsClassName: `Reicht className an den äußeren Wrapper durch.`,
                            forwardsStyle: `Reicht Inline-Style an den äußeren Wrapper durch.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Die 3D-Szene ist richtungs-agnostisch; der Wrapper wird nicht gespiegelt.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <Image360Viewer> akzeptiert.` }
                }
            },
            consoleManager: {
                default: { title: `Standard`, description: `Konsolen-Multiplexer mit Reitern: ein Terminal-Tab und ein LogView-Tab. Doppelklick auf einen Tab benennt um, Ziehen sortiert, + erzeugt neue.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<ConsoleManager> hostet einen oder mehrere registrierte Konsolentypen (Terminal, LogView, eigene) in einer Tab- und teilbaren Pane-Struktur. Tabs bleiben über Tab- und Pane-Wechsel hinweg gemountet, sodass laufende Konsolen niemals zurückgesetzt werden.` },
                    composition: { title: `Komposition`, body: `ConsoleType.render() wird einmal pro neu erzeugtem Tab aufgerufen; das Ergebnis bleibt für die Lebensdauer dieses Tabs gemountet. defaultName(ordinal) steuert die typspezifische automatische Benennung.` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Zwei registrierte Konsolentypen: ein interaktives Terminal und eine statische LogView-Pane.` } },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich <ConsoleManager> verhalten soll — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            seedsTabs: `Rendert die initial vorgegebenen Tabs und markiert den ersten als aktiv.`,
                            opensNewTab: `Drücken von + öffnet einen neuen Tab in der aktuell aktiven Pane (bei genau einem registrierten Typ).`,
                            closesTab: `Schließt den aktiven Tab und fällt auf den vorherigen Tab zurück.`,
                            renamesOnDblClick: `Doppelklick → Umbenennen → Eingabetaste übernimmt den neuen Namen.`,
                            typePicker: `Zeigt den Typ-Auswahl-Chevron, wenn mehr als ein Konsolentyp registriert ist.`,
                            splitRight: `"Rechts teilen" verwandelt das Blatt in eine horizontale Teilung mit einer neuen Schwester-Pane.`,
                            collapseSplit: `Das Schließen des letzten Tabs in einer durch Split entstandenen Pane klappt die Teilung zurück in eine einzelne Pane.`,
                            keepsInactiveMounted: `Hält inaktive Tab-Inhalte gemountet, damit sie einen Tab-Wechsel überleben.`,
                            dragReorder: `Per Drag-and-drop innerhalb einer Pane wird die Reihenfolge der Tabs vertauscht.`,
                            dragCrossPane: `Das Ziehen eines Tabs aus Pane 1 auf einen Tab in Pane 2 verschiebt ihn dorthin.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Tab-Liste und Split-Layout werden unter dir="rtl" gespiegelt; Tab-Inhalte behalten ihre eigene Richtung.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <ConsoleManager> akzeptiert.` }
                }
            },
            timeline: {
                default: { title: `Standard`, description: `Eine 10-stündige Deployment-Historie mit Punkt- und Bereichsereignissen in den Status „success“, „warning“, „error“ und „info“. Ziehe an den Kanten der Bildlaufleiste unten, um in einen Tagesabschnitt zu zoomen; ziehe an der Mitte, um zu schwenken.` },
                videoScrubbing: { title: `Video-Scrubbing`, description: `90-Sekunden-Clip mit Kapitelmarken und kontrollierter Abspielposition. Klicke irgendwo auf die Spur zum Springen oder fasse den Playhead-Griff und zieh ihn — dasselbe Scrubbing-Modell wie in einem Videoeditor.` },
                rtl: { title: `RTL`, description: `Timeline unter dir="rtl". Die Spur selbst bleibt links-nach-rechts (Zeit fließt immer vorwärts), Beschriftungen und Titel spiegeln.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<Timeline> rendert eine kontinuierliche Zeitachse mit Ereignissen, die an ihren echten Zeitstempeln platziert sind. Eine in der Größe veränderbare Bildlaufleiste darunter steuert immer den sichtbaren Bereich — ziehe am Griff zum Schwenken, an den Kanten zum Zoomen.` },
                    composition: { title: `Komposition`, body: `Mit currentTime + onCurrentTimeChange wird die Hauptspur zu einem interaktiven Scrubber im Videoeditor-Stil. Mit viewRange + onViewRangeChange übernimmst du die Kontrolle über Schwenken und Zoomen. Senke minViewRangeMs für frame-genaue Präzision.` },
                    examples: {
                        title: `Beispiele`,
                        default: { title: `Standard`, description: `Eine 10-stündige Deployment-Historie mit Punkt- und Bereichsereignissen in den Status „success“, „warning“, „error“ und „info“. Ziehe an den Kanten der Bildlaufleiste unten, um in einen Tagesabschnitt zu zoomen; ziehe an der Mitte, um zu schwenken.` },
                        videoScrubbing: { title: `Video-Scrubbing`, description: `90-Sekunden-Clip mit Kapitelmarken und kontrollierter Abspielposition. Klicke irgendwo auf die Spur zum Springen oder fasse den Playhead-Griff und zieh ihn — dasselbe Scrubbing-Modell wie in einem Videoeditor.` }
                    },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich <Timeline> verhalten soll — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            plotsPoints: `Platziert ein Punktereignis an der richtigen x-Position basierend auf seinem Zeitstempel und dem aktiven Sichtbereich.`,
                            plotsRanges: `Stellt ein Bereichsereignis (mit endTimestamp) als Balken dar, dessen Breite der Spanne entspricht.`,
                            hidesOutsideView: `Blendet Ereignisse aus, deren Zeitstempel außerhalb des aktuellen Sichtbereichs liegt.`,
                            rendersPlayhead: `Stellt die Abspielposition an der currentTime-Stelle innerhalb des Sichtbereichs dar.`,
                            scrubsOnClick: `Ein Klick auf die Spur setzt die Abspielposition auf diesen Zeitstempel, sofern onCurrentTimeChange verdrahtet ist.`,
                            scrubsOnDrag: `Ein Ziehen über die Spur aktualisiert die Abspielposition fortlaufend, während sich der Zeiger bewegt.`,
                            readOnlyWhenNoHandler: `Ohne onCurrentTimeChange ist die Abspielposition schreibgeschützt und PointerDowns auf der Spur werden ignoriert.`,
                            pansOnThumb: `Ziehen am Bildlaufgriff verschiebt den Sichtbereich, ohne dessen Breite zu ändern.`,
                            zoomsOnHandle: `Ziehen an einer der beiden Kanten des Bildlaufgriffs verändert den Sichtbereich, ohne die gegenüberliegende Kante zu bewegen.`,
                            clampsZoom: `Der Zoom ist gekappt, sodass der Sichtbereich nie kleiner als minViewRangeMs werden kann.`,
                            controlled: `Im kontrollierten Modus meldet die Komponente Gesten über onViewRangeChange und mutiert keinen internen State.`,
                            resetZoom: `Eine Schaltfläche „Zoom zurücksetzen“ erscheint nur, wenn herangezoomt ist, und stellt beim Klick das volle Fenster wieder her.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Die Spur behält unter dir="rtl" eine Zeitachse von links nach rechts — Zeit fließt immer vorwärts —, während umgebende Beschriftungen spiegeln.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <Timeline> akzeptiert.` }
                }
            },
            nodeEditor: {
                default: { title: `Typisierter Graph`, description: `Vier Knoten, verbunden über typisierte Ports. Der Slider-Knoten gibt eine Zahl aus; zieh von seinem rechten Anschluss zum Eingang des Doublers, um 2× live zu sehen. Der Text-Knoten gibt einen String aus — eine Verbindung zu einem Zahl-Eingang lehnt der typisierte Validator ab. Jeder Knoten-Body bettet eine beliebige React-Komponente (Slider, Input, Live-Werte) ein, um Zwischenergebnisse anzuzeigen.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<NodeEditor> umhüllt @xyflow/react (React Flow) mit eingebauter Port-Typ-Validierung, einem Standard-Knoten-Renderer (TypedNode), der beliebige React-Inhalte einbettet, und einer lazy geladenen Implementierungs-Chunk, sodass Konsumenten den Bundle-Aufpreis nur zahlen, wenn ein Node-Editor tatsächlich gemountet wird.` },
                    composition: { title: `Komposition`, body: `Verwende <TypedHandle portType="..."> innerhalb eigener Knoten, um Port-Typen mit strikter Gleichheit zu deklarieren. Die isValidConnection des Editors lehnt jede Verbindung ab, deren Quell- und Ziel-portType voneinander abweichen — oder bei der eine Seite typisiert und die andere nicht ist. Übergib deine eigenen Renderer per nodeTypes; der eingebaute "typed"-Renderer (TypedNode) ist immer registriert und liest inputs/outputs/body aus node.data.` },
                    examples: {
                        title: `Beispiele`,
                        default: { title: `Typisierter Graph`, description: `Vier Knoten, verbunden über typisierte Ports. Der Slider-Knoten gibt eine Zahl aus; zieh von seinem rechten Anschluss zum Eingang des Doublers, um 2× live zu sehen. Der Text-Knoten gibt einen String aus — eine Verbindung zu einem Zahl-Eingang lehnt der typisierte Validator ab. Jeder Knoten-Body bettet eine beliebige React-Komponente (Slider, Input, Live-Werte) ein, um Zwischenergebnisse anzuzeigen.` }
                    },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich <NodeEditor> verhalten soll — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            acceptsMatchingTypes: `Eine Verbindung zwischen zwei TypedHandles wird akzeptiert, wenn beide portType-Strings gleich sind.`,
                            rejectsMismatchedTypes: `Eine Verbindung zwischen zwei TypedHandles wird abgelehnt, wenn die portTypes abweichen.`,
                            rejectsMixedTypedUntyped: `Eine Verbindung, bei der eine Seite ein TypedHandle und die andere ein nacktes Handle ist, wird abgelehnt.`,
                            allowsTwoUntyped: `Eine Verbindung zwischen zwei untypisierten Handles ist erlaubt.`,
                            rejectsIncompleteDrag: `Ein unvollständiges Drag (source / sourceHandle / target / targetHandle ist null) wird abgelehnt.`,
                            extraAfterTyped: `Ein vom Aufrufer übergebenes isValidConnection wird erst konsultiert, nachdem die Typprüfung bestanden ist.`,
                            lazyChunk: `Die Implementierungs-Chunk wird per React.lazy lazy geladen, sodass das @xyflow/react-Bundle nur ausgeliefert wird, wenn ein NodeEditor gemountet wird.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Die Graph-Leinwand selbst ist richtungs-agnostisch — Koordinaten sind absolut. Eigene Knoten-Renderer sollten Schreibrichtung bei Bedarf in ihren Textinhalten berücksichtigen.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <NodeEditor>, <TypedHandle> und die Datenform des eingebauten TypedNode-Renderers akzeptieren.` }
                }
            },
            dateTimeDisplay: {
                default: { title: `Standard`, description: `Formatiert Timestamps und naive Datumsstrings über Intl.DateTimeFormat unter Nutzung der aktiven Sprache.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<DateTimeDisplay> rendert einen UTC-Timestamp oder einen naiven Datumsstring, formatiert über Intl.DateTimeFormat mit dem aktiven Sprachcode.` },
                    composition: { title: `Komposition`, body: `Übergib timestampMilliseconds (UTC) für absolute Zeiten oder dateTimeNaive für "YYYY-MM-DD HH:mm:ss"-Strings — utcTime erklärt den naiven String als UTC statt lokal.` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Jetzt, ein fester Timestamp sowie derselbe naive String als lokal und als UTC interpretiert.` } },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich <DateTimeDisplay> verhalten soll — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            formatsTimestamp: `Rendert einen formatierten Timestamp, ohne zu werfen.`,
                            utcNaive: `Rendert ein naives UTC-Datum, wenn utcTime gesetzt ist.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Die Ausgabe folgt den BIDI-Regeln des Locales; der Wrapper ist layout-neutral.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <DateTimeDisplay> akzeptiert.` }
                }
            },
            resourceList: {
                default: { title: `Standard`, description: `Tabellenansicht von 600 Deployments mit dem Spalten-Row-Handler. Spaltenbreiten lassen sich am Header ziehen; ein Klick auf den Spaltenkopf sortiert.` },
                grid: { title: `Raster`, description: `360 Farbfelder als feste Kachel-Galerie über GridListRowHandler. Mit dem Slider im Header lässt sich die Anzahl der Spalten anpassen.` },
                multipleLayouts: { title: `Mehrere Layouts`, description: `Derselbe Produktkatalog unter einem Spalten- und einem Raster-Row-Handler. Über den Icon-Picker im Header wechselst du das Layout — die Scrollposition bleibt erhalten.` },
                selection: { title: `Auswahl`, description: `Auswahlzustand über den onSelect-Callback. Klicken, Strg/Cmd-Klick zum Umschalten, Shift-Klick für einen Bereich; das Panel darüber spiegelt Anzahl und zuletzt gewählte ID.` },
                reorderable: { title: `Sortierbar per Drag & Drop`, description: `Setze reorderable an der Liste, um auf jeder Zeile einen Drag-Griff zu rendern. Wird eine Zeile über oder unter einer anderen abgelegt, feuert onReorder(fromIndex, toIndex); der Konsument hält die Daten und führt die Umordnung aus.` },
                crossListDrag: { title: `Drag & Drop zwischen Listen`, description: `Drei Listen. A ↔ B akzeptieren über reorderAcceptsFrom gegenseitig Drops; C akzeptiert nur eigene Drags. Während ein Drag läuft, malt jede andere Liste ein Overlay: ein primärfarbener Rahmen für akzeptierende, ein abgedunkelter Schleier mit „nimmt keine Drops an“-Hinweis für ablehnende.` },
                contextMenu: { title: `Kontextmenü`, description: `Rechtsklick auf eine Zeile öffnet ein Aktionsmenü (Öffnen / Duplizieren / Löschen). Das Beispiel hängt ein Radix-DropdownMenu in onContextMenu innerhalb des Spalten-Render — Ziel des Rechtsklicks ist die Zeile selbst.` },
                multipleListsSharedAction: { title: `Gemeinsame Aktion über Listen hinweg`, description: `Zwei ResourceLists nebeneinander teilen sich eine einzige „Löschen“-Aktion über den globalen ActionManager. Jede Zeile bekommt [data-actionscope] + [data-list-id] + [data-item-id]; der eine Handler liest diese Attribute am rechtsangeklickten Element ab und dispatcht in den State der jeweils richtigen Liste.` },
                horizontalStrip: { title: `Horizontaler Streifen`, description: `Ein eigener RowRendererDirection.Horizontal-Handler rendert einen horizontal scrollenden Streifen aus Karten. Jede Karte bettet FileViewer im „embedded“-Modus ein, sodass die 60 Vorschauen erst beim Scrollen geladen werden.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<ResourceList> rendert eine große, paginierte und virtualisierte Liste beliebiger Ressourcen. Übergib eine getResourcesList-Funktion, die zusammenhängende Fenster vom Server lädt, und einen oder mehrere Row-Handler für das Layout.` },
                    composition: { title: `Komposition`, body: `Stelle einen oder mehrere rowHandlers bereit (Column / Grid / custom) — der Nutzer kann im Header zwischen ihnen wechseln. Sortierungs-Zustand wird an getResourcesList weitergegeben, damit der Server die korrekte Seite liefert.` },
                    examples: {
                        title: `Beispiele`,
                        default: { title: `Standard`, description: `Tabellenansicht von 600 Deployments mit dem Spalten-Row-Handler. Spaltenbreiten lassen sich am Header ziehen; ein Klick auf den Spaltenkopf sortiert.` },
                        grid: { title: `Raster`, description: `360 Farbfelder als feste Kachel-Galerie über GridListRowHandler. Mit dem Slider im Header lässt sich die Anzahl der Spalten anpassen.` },
                        multipleLayouts: { title: `Mehrere Layouts`, description: `Derselbe Produktkatalog unter einem Spalten- und einem Raster-Row-Handler. Über den Icon-Picker im Header wechselst du das Layout — die Scrollposition bleibt erhalten.` },
                        selection: { title: `Auswahl`, description: `Auswahlzustand über den onSelect-Callback. Klicken, Strg/Cmd-Klick zum Umschalten, Shift-Klick für einen Bereich; das Panel darüber spiegelt Anzahl und zuletzt gewählte ID.` },
                        reorderable: { title: `Sortierbar per Drag & Drop`, description: `Setze reorderable an der Liste, um auf jeder Zeile einen Drag-Griff zu rendern. Wird eine Zeile über oder unter einer anderen abgelegt, feuert onReorder(fromIndex, toIndex); der Konsument hält die Daten und führt die Umordnung aus.` },
                        crossListDrag: { title: `Drag & Drop zwischen Listen`, description: `Drei Listen. A ↔ B akzeptieren über reorderAcceptsFrom gegenseitig Drops; C akzeptiert nur eigene Drags. Während ein Drag läuft, malt jede andere Liste ein Overlay: ein primärfarbener Rahmen für akzeptierende, ein abgedunkelter Schleier mit „nimmt keine Drops an“-Hinweis für ablehnende.` },
                        contextMenu: { title: `Kontextmenü`, description: `Rechtsklick auf eine Zeile öffnet ein Aktionsmenü (Öffnen / Duplizieren / Löschen). Das Beispiel hängt ein Radix-DropdownMenu in onContextMenu innerhalb des Spalten-Render — Ziel des Rechtsklicks ist die Zeile selbst.` },
                        multipleListsSharedAction: { title: `Gemeinsame Aktion über Listen hinweg`, description: `Zwei ResourceLists nebeneinander teilen sich eine einzige „Löschen“-Aktion über den globalen ActionManager. Jede Zeile bekommt [data-actionscope] + [data-list-id] + [data-item-id]; der eine Handler liest diese Attribute am rechtsangeklickten Element ab und dispatcht in den State der jeweils richtigen Liste.` },
                        horizontalStrip: { title: `Horizontaler Streifen`, description: `Ein eigener RowRendererDirection.Horizontal-Handler rendert einen horizontal scrollenden Streifen aus Karten. Jede Karte bettet FileViewer im „embedded“-Modus ein, sodass die 60 Vorschauen erst beim Scrollen geladen werden.` }
                    },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich <ResourceList> verhalten soll — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            callsFetcher: `Ruft getResourcesList beim Mounten auf.`,
                            firstWindow: `Erster Fetch übergibt fromIndex=0 und ein endliches, positives limit.`,
                            forwardsSort: `Leitet sortBy und sortDirection im Request-Body weiter.`,
                            reorderFires: `Feuert onReorder mit den from/to-Indizes nach einer Drag-&-Drop-Umordnung.`,
                            crossListAccept: `Akzeptiert Drops nur von Listen, die in reorderAcceptsFrom stehen, und lehnt alle anderen ab.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Header-Buttons und Spaltenanordnung werden unter dir="rtl" gespiegelt.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <ResourceList> akzeptiert.` }
                }
            },
            keyComboRecorder: {
                default: { title: `Standard`, description: `Klicke „Aufzeichnung starten“ und drücke eine beliebige Kombination auf der Tastatur — jeder Tastendruck wird erfasst und an die Liste angehängt. Auch ein allein losgelassener Modifier (z. B. nur Umschalt) wird erfasst.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere die folgenden Abhängigkeiten:`, manualStep2: `Kopiere den folgenden Code in dein Projekt.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<KeyComboRecorder> erfasst Tastenkombinationen live und formatiert sie über den aktiven HotkeyManager — die erzeugten Strings sind direkt mit HotkeyManager.setHotkey() und KeyComboDisplay kompatibel.` },
                    composition: { title: `Komposition`, body: `Verbinde den onCombo-Callback mit dem, was die Combo-Strings konsumiert — ein Einstellungs-Editor, eine kurze Demo oder ein Debugger. Die Start- / Stop- / Leeren-Schaltflächen und die Verlaufsliste sind bereits enthalten.` },
                    examples: { title: `Beispiele`, default: { title: `Standard`, description: `Starte die Aufzeichnung und drücke eine Kombination. Die zuletzt erfasste Combo wird im Harness-State-Panel angezeigt.` } },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich <KeyComboRecorder> verhalten soll — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            startsIdle: `Zeigt vor dem Aufzeichnen die Start-Schaltfläche und den Hinweistext.`,
                            togglesListening: `Wechselt nach dem Start zur Stop-Schaltfläche und blendet den Lausch-Indikator ein.`,
                            capturesCombo: `Erfasst eine echte Combo als Listeneintrag und feuert onCombo.`,
                            capturesModifier: `Erfasst einen allein losgelassenen Modifier (Umschalt-Druck → Umschalt-Loslassen ohne Taste dazwischen).`,
                            clearResets: `Die „Leeren“-Schaltfläche leert die Liste der erfassten Combos.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Layout wird unter dir="rtl" gespiegelt; Combos sind richtungs-agnostisch.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die <KeyComboRecorder> akzeptiert.` }
                }
            },
            chart: {
                bar: { title: `Balken`, description: `Gruppierte Balken auf einer gemeinsamen X-Achse. Serienfarben stammen aus dem <ChartConfig>; Tooltip und Legende lesen die Beschriftungen aus derselben Map.` },
                line: { title: `Linie`, description: `Weiche monotone Linie. Der Tooltip nutzt einen „line“-Indikator, dessen Farbe der Linienfarbe entspricht.` },
                area: { title: `Fläche`, description: `Gestapelte Fläche mit Verlauf pro Serie. <defs> definiert die Gradienten; die Serien referenzieren sie über fill="url(#…)".` },
                pie: { title: `Kreis`, description: `Donut-Diagramm. Die Legende bricht auf schmalen Breiten in zwei Reihen um, damit das Diagramm nie aus dem Container läuft.` },
                radar: { title: `Radar`, description: `Polar-Radar mit zwei überlagerten Serien. Die gestrichelte Serie wird ohne Füllung gezeichnet, damit die durchgezogene als primäres Signal wirkt.` },
                radial: { title: `Radial`, description: `Radialer Balken mit gedämpftem Hintergrund-Ring. Jeder Ring entspricht einem Datensatz und nutzt die Palette aus dem <ChartConfig>.` },
                themed: { title: `Themen-Farben`, description: `Nutzt die „theme“-Form eines <ChartConfig>-Eintrags, um im hellen und dunklen Modus unterschiedliche Farben zu wählen — beim Theme-Wechsel wird die Serie ohne JS neu eingefärbt.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Befehl`, manualTab: `Manuell`, manualStep1: `Installiere das Paket (recharts wird als transitives Paket mitgeliefert):`, manualStep2: `Kopiere ein Beispiel von unten und passe das <ChartConfig> an deine Serien an.`, manualStep3: `Passe die Import-Pfade an deine Projektstruktur an.` },
                    usage: { title: `Verwendung`, body: `<ChartContainer> umschließt jedes recharts-Diagramm, injiziert pro Serie CSS-Farbvariablen und stellt den Kontext bereit, aus dem <ChartTooltipContent> und <ChartLegendContent> die Beschriftungen ableiten. Die Config-Map ist die einzige Quelle für Serienfarben und Anzeigenamen.` },
                    composition: { title: `Komposition`, body: `Farben fließen als CSS-Custom-Properties — dieselbe Komponente kann unter hellem und dunklem Theme neu eingefärbt werden, ohne neu zu rendern. Nutze die „theme“-Form eines Config-Eintrags für getrennte Werte pro Theme oder „color“ für einen gemeinsamen Wert.` },
                    examples: {
                        title: `Beispiele`,
                        bar: { title: `Balken`, description: `Gruppierte Balken mit zwei Serien aus dem <ChartConfig>.` },
                        line: { title: `Linie`, description: `Einzelne Linie mit angepasstem Tooltip-Indikator.` },
                        area: { title: `Fläche`, description: `Gestapelte Fläche mit Verläufen pro Serie aus <defs>.` },
                        pie: { title: `Kreis`, description: `Donut-Pie mit umbrechender Legende auf schmalen Breiten.` },
                        radar: { title: `Radar`, description: `Polar-Radar, das Ist- und Zielwerte überlagert.` },
                        radial: { title: `Radial`, description: `Radialer Balken, der jeden Datensatz als farbigen Ring zeigt.` },
                        themed: { title: `Themen-Farben`, description: `Theme-spezifische Farben, die mit dem App-Theme wechseln.` }
                    },
                    definedBehaviour: {
                        title: `Definiertes Verhalten`, intro: `Aussagen darüber, wie sich die Chart-Primitive verhalten — jede verlinkt mit dem Test, der sie verifiziert.`, verifiedBy: `verifiziert durch`,
                        statements: {
                            rendersWrapper: `Rendert einen <div data-slot="chart">-Wrapper, der den CSS-Scope des Diagramms besitzt.`,
                            stableDataChartId: `Setzt am Wrapper eine stabile data-chart="chart-…"-ID, abgeleitet aus der id-Prop oder React useId.`,
                            forwardsClassName: `Fügt die vom Aufrufer übergebene className zu den Basis-Klassen hinzu, ohne sie zu überschreiben.`,
                            emitsStyleVars: `Gibt einen <style>-Block aus, der „--color-<key>“-Custom-Properties für jeden Config-Eintrag mit color oder theme definiert.`,
                            mountsRecharts: `Mountet einen recharts-Teilbaum (BarChart + Tooltip + Bar) innerhalb des Containers ohne Fehler.`,
                            styleNothingWithoutColor: `<ChartStyle> rendert nichts, wenn kein Config-Eintrag color oder theme definiert.`,
                            styleThemeScopes: `<ChartStyle> erzeugt eine Regel für das helle und eine „.dark“-gescopte Regel für das dunkle Theme.`,
                            tooltipInactive: `<ChartTooltipContent> rendert nichts, wenn nicht aktiv.`,
                            tooltipRendersLabel: `<ChartTooltipContent> rendert die konfigurierte Beschriftung und den formatierten (toLocaleString) Wert pro Payload-Eintrag.`,
                            legendEmptyPayload: `<ChartLegendContent> rendert nichts, wenn die Payload leer ist.`,
                            legendRendersRows: `<ChartLegendContent> rendert eine Zeile pro Payload-Eintrag und liest die Beschriftung aus der Config.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Recharts ordnet von links nach rechts an; Wrapper und Tooltip kippen unter dir="rtl", die Achsen selbst sind richtungs-agnostisch.` },
                    apiReference: { title: `API-Referenz`, intro: `Props, die die Chart-Primitive akzeptieren.` }
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
            themePicker: {
                description: `Trigger (links) und eigenständige Variante (rechts).`
            },
            loggingConfig: {
                description: `Datei-spezifische Log-Level-Überschreibungen, im localStorage gespeichert.`
            },
            resourceList: {
                description: `ResourceList rendert große, unendlich scrollende Listen beliebiger Ressourcen — mit einer paginierten getResourcesList-Funktion und einem oder mehreren Row-Handlern.`,
                note: `Auf der ResourceList-Komponentenseite findest du lauffähige Spalten-, Raster-, Mehr-Layout- und Auswahl-Beispiele.`,
                crossListDrag: {
                    intro: `Drei Listen. {ab} akzeptieren gegenseitig Drops; {c} lehnt alles ab. Starte einen Drag in einer beliebigen Liste — die anderen leuchten auf und zeigen, ob sie ihn annehmen (primärfarbener Rahmen = akzeptiert, abgedunkeltes Overlay = abgelehnt). Alle drei erlauben weiterhin internes Umordnen.`,
                    introBold: `A ↔ B`,
                    listLabel: `Liste`,
                    acceptsPrefix: `akzeptiert`,
                    acceptsSelfOnly: `nur eigene`
                }
            },
            consoleManager: {
                description: `VSCode-artiges Konsolen-Host. Mit + neue Tabs öffnen, Doppelklick auf einen Tab zum Umbenennen, beim Hovern zum Schließen (×), und die Split-Buttons rechts teilen das Pane horizontal oder vertikal.`,
                terminalLabel: `Terminal`,
                logsLabel: `Logs`
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
