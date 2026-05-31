import baseDe from "../../lib/lib/languages/de/default";
import { stepsDe } from "../examples/steps/translations";
import type { Translation } from "../languages";
import { ExampleActionIds } from "../exampleActions";
import { actionDisplayDe } from "../examples/actionDisplay/translations";
import { audioPlayerDe } from "../examples/audioPlayer/translations";
import { avatarDe } from "../examples/avatar/translations";
import { badgeDe } from "../examples/badge/translations";
import { buttonDe } from "../examples/button/translations";
import { buttonSelectDe } from "../examples/buttonSelect/translations";
import { calendarDe } from "../examples/calendar/translations";
import { cardDe } from "../examples/card/translations";
import { chartDe } from "../examples/chart/translations";
import { chatDe } from "../examples/chat/translations";
import { checkboxDe } from "../examples/checkbox/translations";
import { codeSnippetDe } from "../examples/codeSnippet/translations";
import { codeThemePickerDe } from "../examples/codeThemePicker/translations";
import { codeViewerDe } from "../examples/codeViewer/translations";
import { collapsibleDe } from "../examples/collapsible/translations";
import { colorCurvesDe } from "../examples/colorCurves/translations";
import { commandPaletteDe } from "../examples/commandPalette/translations";
import { compassDe } from "../examples/compass/translations";
import { consoleManagerDe } from "../examples/consoleManager/translations";
import { contextMenuDe } from "../examples/contextMenu/translations";
import { copyValueButtonDe } from "../examples/copyValueButton/translations";
import { dateTimeDisplayDe } from "../examples/dateTimeDisplay/translations";
import { dateTimePickerDe } from "../examples/dateTimePicker/translations";
import { dateTimeRangePickerDe } from "../examples/dateTimeRangePicker/translations";
import { dialogDe } from "../examples/dialog/translations";
import { dropdownMenuDe } from "../examples/dropdownMenu/translations";
import { emojiPickerDe } from "../examples/emojiPicker/translations";
import { expandableCodeDe } from "../examples/expandableCode/translations";
import { expandableSectionDe } from "../examples/expandableSection/translations";
import { shareDialogDe } from "../examples/shareDialog/translations";
import { fileIconDe } from "../examples/fileIcon/translations";
import { fileViewerDe } from "../examples/fileViewer/translations";
import { globalContextMenuDe } from "../examples/globalContextMenu/translations";
import { hoverCardDe } from "../examples/hoverCard/translations";
import { image360ViewerDe } from "../examples/image360Viewer/translations";
import { inlineEditDe } from "../examples/inlineEdit/translations";
import { inputDe } from "../examples/input/translations";
import { inputGroupDe } from "../examples/inputGroup/translations";
import { keyComboDisplayDe } from "../examples/keyComboDisplay/translations";
import { keyComboRecorderDe } from "../examples/keyComboRecorder/translations";
import { keyboardShortcutEditorDe } from "../examples/keyboardShortcutEditor/translations";
import { labelDe } from "../examples/label/translations";
import { languagePickerDe } from "../examples/languagePicker/translations";
import { coordinateLinksDe } from "../examples/coordinateLinks/translations";
import { iconBadgeDe } from "../examples/iconBadge/translations";
import { locationPickerDe } from "../examples/locationPicker/translations";
import { logViewDe } from "../examples/logView/translations";
import { loggingConfigDe } from "../examples/loggingConfig/translations";
import { lyricsDe } from "../examples/lyrics/translations";
import { openingHoursDe } from "../examples/openingHours/translations";
import { machineMonitorDe } from "../examples/machineMonitor/translations";
import { mapDe } from "../examples/map/translations";
import { mapStylePickerDe } from "../examples/mapStylePicker/translations";
import { modalHandlerDe } from "../examples/modalHandler/translations";
import { nodeEditorDe } from "../examples/nodeEditor/translations";
import { numberInputDe } from "../examples/numberInput/translations";
import { optionPickerDe } from "../examples/optionPicker/translations";
import { pageIndexDe } from "../examples/pageIndex/translations";
import { popoverDe } from "../examples/popover/translations";
import { primaryMenuDe } from "../examples/primaryMenu/translations";
import { progressDe } from "../examples/progress/translations";
import { radioGroupDe } from "../examples/radioGroup/translations";
import { resizableDe } from "../examples/resizable/translations";
import { resourceListDe } from "../examples/resourceList/translations";
import { scrollAreaDe } from "../examples/scrollArea/translations";
import { searchInputDe } from "../examples/searchInput/translations";
import { searchSelectPickerDe } from "../examples/searchSelectPicker/translations";
import { sectionHeadingDe } from "../examples/sectionHeading/translations";
import { selectDe } from "../examples/select/translations";
import { historyPanelDe } from "../examples/historyPanel/translations";
import { settingsPanelDe } from "../examples/settingsPanel/translations";
import { sidebarDe } from "../examples/sidebar/translations";
import { skeletonDe } from "../examples/skeleton/translations";
import { sliderDe } from "../examples/slider/translations";
import { sonnerDe } from "../examples/sonner/translations";
import { staggeredCheckboxesDe } from "../examples/staggeredCheckboxes/translations";
import { switchDe } from "../examples/switch/translations";
import { tabsDe } from "../examples/tabs/translations";
import { terminalDe } from "../examples/terminal/translations";
import { textareaDe } from "../examples/textarea/translations";
import { themePickerDe } from "../examples/themePicker/translations";
import { timePickerDe } from "../examples/timePicker/translations";
import { timelineDe } from "../examples/timeline/translations";
import { timezoneSelectorDe } from "../examples/timezoneSelector/translations";
import { videoViewerDe } from "../examples/videoViewer/translations";
import { weatherChipDe } from "../examples/weatherChip/translations";
import { weatherExpandableDe } from "../examples/weatherExpandable/translations";

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
                chat: `Chat`,
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
            creatingAppsLabel: `Apps erstellen`,
            translationsLabel: `Übersetzungen`,
            settingsSystemLabel: `Settings-System`
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
            },
            translations: {
                title: `Übersetzungen`,
                overview: {
                    title: `Überblick`,
                    intro: `Jeder übersetzbare String in der Bibliothek und in deiner eigenen App fließt durch ein typisiertes Objekt: \`t\`. Die Bibliothek besitzt ihren Anteil (\`BaseTranslation\`), deine App erweitert die Form über TypeScript Declaration Merging, und \`<MowsProvider>\` führt den aufgelösten Baum der aktiven Sprache unter \`useMows().t\`.`,
                    baseTranslation: {
                        title: `BaseTranslation`,
                        body: `Definiert in \`lib/lib/languages.ts\`. Listet jeden String auf, den die Bibliothek selbst rendert — \`<PrimaryMenu>\`, \`<CommandPalette>\`, \`<SettingsPanel>\`, \`<VideoViewer>\`, Tastenlabels und so weiter. Apps bearbeiten dieses Interface nicht; es ist der Vertrag, den jede aus der Bibliothek ausgelieferte Locale erfüllen muss.`
                    },
                    translationInterface: {
                        title: `Translation`,
                        body: `Ebenfalls in \`lib/lib/languages.ts\`. Beginnt als reine Erweiterung von \`BaseTranslation\` und ist der Typ, auf den jeder Konsument zugreift. Deine App ergänzt ihn via \`declare module ".../languages" { interface Translation { … } }\`, um eigene Schlüssel hinzuzufügen — so liefert dasselbe \`t\`-Objekt sowohl Bibliotheks- als auch App-Strings.`
                    },
                    language: {
                        title: `Language`,
                        body: `Ein kleiner Record mit Sprachcode (\`en-US\`, \`de\`), Anzeigename, Emoji und einem \`import()\`-Thunk, der die aufgelöste \`Translation\` für diese Locale zurückgibt. Die vollständigen Daten jeder Locale leben in einem eigenen Modul, sodass der Sprachumschalter dynamisch nur die vom Nutzer gewählte Locale lädt.`
                    },
                    provider: {
                        title: `Verdrahtung im MowsProvider`,
                        body: `\`<MowsProvider>\` nimmt \`languages\` (die verfügbaren \`Language[]\`) und \`initialTranslation\` (den eager gebundelten Baum für das erste Rendering). Er nimmt die gespeicherte Wahl des Nutzers via \`storagePrefix\` + Browsersprache auf, ruft beim Mount das passende \`Language.import()\` und rendert die Konsumenten beim Wechsel über \`setLanguage()\` mit dem neuen Baum neu. Der aktive Baum ist über Context stets als \`t\` erreichbar.`
                    }
                },
                setup: {
                    title: `Einrichtung`,
                    intro: `Übersetzungen werden einmal am Root verdrahtet. Alles weitere — Sprachumschaltung, Persistenz, automatische Browserspracherkennung — übernimmt der Provider.`,
                    mountProvider: {
                        title: `Mit languages + initialem Baum mounten`,
                        body: `Übergib \`languages\` und \`initialTranslation\` an \`<MowsProvider>\`. Wähle die initiale Locale zuerst über \`localStorage\`, dann \`navigator.language\`, dann ein hartcodiertes englisches Fallback. Lade die gewählte Locale per dynamischem \`import()\`, bevor du React mountest — Vite gibt pro Locale einen eigenen Chunk aus, sodass Nutzer nur die Locale herunterladen, mit der sie starten. Die \`main.tsx\` der Beispiel-App zeigt das exakte Muster.`
                    },
                    defaultLanguages: {
                        title: `Ohne languages-Prop reichen Englisch + Deutsch`,
                        body: `Lässt du \`languages\` weg, fällt \`<MowsProvider>\` auf \`baseLanguages\` zurück (von der Bibliothek ausgeliefertes Englisch + Deutsch). Das genügt Apps, die keine eigenen Übersetzungsschlüssel anlegen. Sobald deine App \`Translation\` erweitert, liefere ein eigenes \`Language[]\` mit, damit das \`import()\` jedes Eintrags den erweiterten Baum zurückgibt — nicht den Basisbaum.`
                    }
                },
                reading: {
                    title: `Übersetzungen auslesen`,
                    intro: `\`t\` aus dem Context holen und den typisierten Pfad dereferenzieren. Keine String-Schlüssel, keine Lookup-Fehler — wenn der Punkt-Pfad nicht typisiert, ist der Wert nicht vorhanden.`,
                    hooks: {
                        title: `Funktionskomponenten — useMows()`,
                        body: `Rufe \`useMows()\` für den vollen Context auf und lies \`t.<pfad>\`. Derselbe Hook liefert alles andere mit (Theme, Action Manager, Modal-State, …), sodass die meisten Komponenten nur einen Context-Call brauchen.`
                    },
                    classComponents: {
                        title: `Klassenkomponenten — contextType`,
                        body: `Die meisten Komponenten dieser Bibliothek sind Klassenkomponenten. Setze \`static contextType = MowsContext\` und deklariere \`context: ContextType<typeof MowsContext>\`, dann lies \`this.context!.t.<pfad>\` in \`render()\`. \`this.context\` ist gegen \`MowsContextType\` typisiert, sodass dieselbe Punkt-Pfad-Vervollständigung greift.`
                    },
                    actions: {
                        title: `Action-Labels — der einzige dynamische Schlüssel`,
                        body: `Action-Labels leben unter \`t.actions[ActionId]\`. Das ist die einzige Stelle, an der der Schlüssel dynamisch statt statisch typisiert ist — Action-IDs sind namensbereinigte Strings (\`myapp.document.create\`), die der Aufrufer wählt, der Typ ist \`Record<string, string>\`. Schlage via \`t.actions[CoreActionIds.OpenCommandPalette]\` (oder dein eigenes Enum) nach und der Action Manager rendert das aufgelöste Label in der Command Palette, im Tastenkürzel-Editor und im Kontextmenü.`
                    }
                },
                extending: {
                    title: `Eigene Übersetzungsschlüssel ergänzen`,
                    intro: `Wenn deine App Strings über das hinaus braucht, was die Bibliothek mitbringt, erweitere das \`Translation\`-Interface via TypeScript Declaration Merging und stelle pro Locale eine Datei bereit. Die Erweiterung ist rein typischer Natur — zur Laufzeit werden die Strings einfach zu zusätzlichen Feldern desselben \`t\`-Objekts.`,
                    declareMerge: {
                        title: `Translation-Interface erweitern`,
                        body: `Schreibe in deiner App einen \`declare module ".../languages" { interface Translation { … } }\`-Block, der deinen Namespace hinzufügt. Verwende einen Top-Level-Schlüssel pro Feature-Bereich (\`dashboard\`, \`settings\`, \`onboarding\`), damit mehrere Teams ihre Anteile ohne Kollisionen wachsen lassen können. Die Schlüssel der Bibliothek bleiben unberührt; deine Ergänzungen erscheinen daneben auf \`t\`.`
                    },
                    perLocaleFile: {
                        title: `Eine Datei pro Locale, mit Spread der Basis`,
                        body: `Baue für jede Locale ein Modul, das die Basislokale der Bibliothek (\`baseEn\`, \`baseDe\`) importiert, spreaded und deine eigenen Schlüssel auffüllt. \`const translation: Translation = { ...baseEn, … }\` typisiert gegen das erweiterte Interface — jeder Bibliotheksschlüssel behält seinen Standardwert, und jeder App-Schlüssel, den du angelegt hast, wird zur Compile-Zeit eingefordert.`
                    },
                    consumeOwnKeys: {
                        title: `Konsumenten lesen eigene Schlüssel genauso`,
                        body: `Innerhalb der App ist \`useMows().t.dashboard.greeting\` ebenso typisiert wie \`useMows().t.primaryMenu.login\` — es gibt keinen zweiten \`useAppT()\`-Hook zu merken und keinerlei Gefahr, dass eine Bibliotheksübersetzung gegen eine App-Übersetzung divergiert, weil es nur einen Baum gibt.`
                    }
                },
                slicing: {
                    title: `Locale-Dateien in Feature-Slices aufteilen`,
                    intro: `Sobald \`Translation\` mehr als eine Handvoll Features umfasst, passt die Locale-Datei nicht mehr in den Kopf eines Reviewers. Eine Slice-Datei zieht alle Strings einer Komponente — Typ und beide Locale-Werte — in ein einziges Modul direkt neben der Komponente. Die obersten Locale-Dateien werden zur kurzen Liste von \`...\`-Spread-Referenzen, und das Hinzufügen eines Schlüssels lässt den Compile in jeder Locale weiterhin scheitern, weil der Slice-Typ das ist, worauf die oberste Schnittstelle verweist.`,
                    sliceFile: {
                        title: `Eine Datei pro Komponente, Typ + beide Locale-Werte`,
                        body: `Lege \`translations.ts\` direkt neben die Komponente (z. B. \`src/examples/steps/translations.ts\`) und exportiere drei Dinge: \`StepsTranslation\` (die Form), \`stepsEn\` typisiert als \`StepsTranslation\` und \`stepsDe\` typisiert als \`StepsTranslation\`. Wer die Komponente anfasst, bearbeitet eine Datei statt drei.`
                    },
                    wiring: {
                        title: `Eine Slice in den Baum einhängen`,
                        body: `Ersetze im obersten Typ das Inline-Literal des Features durch den Slice-Typ: \`steps: StepsTranslation\`. Ersetze in jeder Locale-Datei das Inline-Literal durch die Slice-Konstante: \`steps: stepsEn\` / \`steps: stepsDe\`. Die Annotation \`const translation: Translation = { … }\` zwingt nach wie vor zur Befüllung jedes Pflichtschlüssels — die Slice schiebt die Strings nur in eine andere Datei.`
                    },
                    bundle: {
                        title: `Was Slicing am Bundle ändert (und was nicht)`,
                        body: `Slice-Auslagerung ist Wartbarkeit, kein Code-Splitting — die Strings landen unabhängig vom Quellort im selben Chunk. Das Bundle-Layout entscheidet dein Einstiegspunkt: importierst du beide Locales statisch, faltet der Bundler sie in den Haupt-Chunk; lädst du die initiale Locale per dynamischem \`import()\`, gibt der Bundler pro Locale einen eigenen Chunk aus. Eager für sofortigen First Paint, dynamisch für einen schlankeren Haupt-Chunk.`
                    }
                },
                switching: {
                    title: `Sprache zur Laufzeit wechseln`,
                    intro: `\`setLanguage(language)\` tauscht die aktive Locale. Der Provider ruft \`language.import()\` auf, wartet auf den Chunk, persistiert die Auswahl unter \`storagePrefix_language\` und rendert mit dem neuen \`t\` neu.`,
                    runtime: {
                        title: `Wechsel auslösen`,
                        body: `Rufe \`setLanguage\` aus \`useMows()\` mit dem Ziel-\`Language\`-Record auf. Der mitgelieferte \`<LanguagePicker>\` macht genau das — derselbe Aufruf funktioniert aus deiner eigenen UI, wenn du einen eigenen Einstiegspunkt brauchst. Die persistierte Wahl überlebt Reloads; Löschen des Storage-Eintrags fällt auf die Browsersprache zurück.`
                    },
                    chunks: {
                        title: `Code-Chunks pro Locale`,
                        body: `Jedes \`Language.import\` ist ein dynamisches \`import()\`. Vite gibt pro Locale einen eigenen Chunk aus, sodass Nutzer nur die Locales herunterladen, zu denen sie tatsächlich wechseln. Das erste Rendering nutzt \`initialTranslation\` (eager gebundelt), spätere Wechsel kommen aus dem Netz oder dem HTTP-Cache.`
                    }
                },
                safety: {
                    title: `Compile-Zeit-Garantien`,
                    intro: `Der Sinn der Typisierung des Übersetzungsbaums ist, dass der Compiler keiner Locale erlaubt, auseinanderzulaufen. Füg einen Schlüssel hinzu, ohne ihn überall einzutragen, und \`tsc\` schlägt Alarm; der Testsuite hält die Eigenschaft fest.`,
                    compileCheck: {
                        title: `Jede Locale-Datei ist ein Translation`,
                        body: `Jedes Per-Locale-Modul deklariert \`const translation: Translation = { … }\`. Füg einen neuen Schlüssel zu \`Translation\` hinzu (in der Bibliothek oder via App-seitiger Erweiterung), und jede Locale-Datei scheitert bei der Compilierung, bis der Schlüssel ausgefüllt ist. Keine stillen Fallbacks, kein unübersetzter String, der durchrutscht.`
                    },
                    complianceTest: {
                        title: `localesAreCompliant.test.ts`,
                        body: `\`lib/lib/languages/localesAreCompliant.test.ts\` importiert jede ausgelieferte Locale und prüft ihren Typ erneut gegen \`BaseTranslation\`. \`pnpm test\` (oder \`pnpm build\`) deckt einen fehlenden Locale-Slot genauso auf wie ein CI-Lauf — es gibt keinen Pfad, auf dem eine Übersetzungslücke unbemerkt in Produktion gerät.`
                    }
                },
                conventions: {
                    title: `Konventionen & Stolperfallen`,
                    intro: `Muster, die den Baum mit Wachstum wartbar halten.`,
                    namespacing: {
                        title: `Nach Feature, nicht nach Komponente benennen`,
                        body: `Gruppiere Strings nach nutzerseitigem Konzept (\`onboarding.welcome\`, \`settings.appearance\`) statt nach Komponentenname. Die Bibliothek macht das Gegenteil — sie ordnet nach Komponente (\`primaryMenu\`, \`commandPalette\`), weil ihre Oberflächen ihre Komponenten SIND. App-Schlüssel überleben Komponentenumbenennungen; ein Feature-Namespace ist die stabilere Grundlage.`
                    },
                    flatKeys: {
                        title: `Den Baum nicht flach klopfen`,
                        body: `Widerstehe der Versuchung, \`t["settings.theme.title"]\` zu schreiben. Verschachtelte Objekte sind durchgehend typisiert und refaktorierbar; klammerindizierte flache Schlüssel zerstören Autovervollständigung, brechen Refactoring-Werkzeuge und machen Missing-Key-Bugs zu Laufzeitfehlern. Die einzige unvermeidliche Stelle sind Action-Labels (siehe „Übersetzungen auslesen“) — und selbst dort kommen die Schlüssel aus einem Enum.`
                    },
                    actionIds: {
                        title: `Action-Labels sind der einzige dynamische Slot`,
                        body: `\`t.actions[id]\` ist ein \`Record<string, string>\`, weil Action-IDs offen sind. Bezieh die ID immer aus einem Enum oder einer Konstanten, damit ein Tippfehler an der Aufrufstelle ein Tippfehler an der Lookup-Stelle bleibt. Die Übersetzungsdatei ist der Ort, an dem das Label gerendert wird — halte beide Hälften nah beieinander, wenn du eine neue Action hinzufügst.`
                    },
                    spreadBase: {
                        title: `Immer die Basis-Locale spreaden`,
                        body: `Per-Locale-App-Dateien starten mit \`...baseEn\` (oder \`...baseDe\`), damit die Strings der Bibliothek ihre Werte behalten, ohne dupliziert zu werden. Vergisst du den Spread, typisieren deine App-seitigen Schlüssel zwar einzeln, aber die zusammengeführte \`Translation\` fehlt jeder Bibliotheksschlüssel — und der Compile-Fehler taucht erst an der Zuweisungsstelle auf, weit weg vom fehlenden Feld.`
                    }
                }
            },
            settingsSystem: {
                title: `Settings-System`,
                overview: {
                    title: `Überblick`,
                    intro: `Jede Einstellung, die deine App persistiert — die der Bibliothek (Theme, Sprache, Hotkey-Overrides, …) und alles, was du selbst hinzufügst — lebt in einem JSON-Blob unter einem einzigen \`localStorage\`-Key. Nutzer können diesen Blob kopieren, in einen anderen Browser einfügen und den kompletten UX-Zustand in einem Schritt wiederherstellen.`,
                    oneBlob: {
                        title: `Ein Key, ein Blob`,
                        body: `Der Key heißt \`\${storagePrefix}_settings\`. Im Inhalt: \`_v\` (Schema-Version), \`core\` (von der Lib verwaltete Slots) und \`app\` (deine Felder, per \`appKey\` als Sub-Key gruppiert). Die Trennung ist bewusst — siehe nächste Unterabschnitt.`
                    },
                    coreVsApp: {
                        title: `core vs. app`,
                        body: `\`core.*\` ist der Vertrag, der der Bibliothek gehört. Das Schema ist stabil, damit eine zukünftige Settings-API diese Werte für denselben Nutzer geräte-/app-übergreifend synchronisieren kann. \`app.<appKey>.*\` gehört dir — definiert durch dein Schema, bleibt geräte-lokal, auch wenn \`core\` später remote synchronisiert wird.`
                    },
                    futureSync: {
                        title: `Zukunft: Remote-Sync für core`,
                        body: `Heute liegt der Blob ausschließlich in \`localStorage\`. Die Persistenzschicht im \`SettingsManager\` ist bewusst ein Interface (\`SettingsStorageAdapter\`), damit ein zukünftiger Remote-Sync-Provider für \`core\` ohne Consumer-Änderungen rein-gesteckt werden kann. \`_v\` versioniert das Wire-Format dafür.`
                    }
                },
                quickStart: {
                    title: `Quick-Start`,
                    intro: `Drei Schritte: Schema deklarieren, auf \`<MowsProvider>\` registrieren, mit \`useAppSetting\` lesen+schreiben.`,
                    defineSchema: {
                        title: `1. Schema deklarieren`,
                        body: `\`defineAppSettings({ appKey, schema })\` ist ein runtime-freier Helper, der das Schema-Objekt verbatim plus einen stabilen \`appKey\` zurückgibt. Jeder Eintrag im Schema ist ein typisierter Field-Descriptor: \`type\` ("boolean" | "select" | "number" | "slider" | "string" | "color"), \`default\`, \`label\`, optional \`group\` für die Platzierung im SettingsPanel.`
                    },
                    registerSchema: {
                        title: `2. Auf MowsProvider registrieren`,
                        body: `Das Schema via \`<MowsProvider appSettings={…}>\` reichen. Damit ist die Registry gefüllt, aus der die typisierten Hooks lesen. Ein Schema pro App — Multi-Schema ist kein unterstütztes Muster.`
                    },
                    readWrite: {
                        title: `3. Lesen + Schreiben mit useAppSetting`,
                        body: `\`useAppSetting(schema, "fieldId")\` gibt \`[value, setValue]\` vollständig typ-inferiert aus dem Schema zurück. Der Hook abonniert nur den spezifischen Pfad — fremde Writes lösen keinen Re-Render aus. Defaults greifen automatisch — der Runtime-Type-Guard fällt auf den Default zurück, wenn der gespeicherte Wert nicht zum deklarierten Typ passt (defensiv gegen Blob-Korruption).`
                    }
                },
                fields: {
                    title: `Feldtypen`,
                    intro: `Die Feldtypen im Schema mappen auf die Primitiven, die \`<SettingsPanel>\` rendern kann:`,
                    builtin: {
                        title: `Eingebaut`,
                        body: `\`boolean\` → Switch · \`select\` → Select (typisiert über die Option-Values) · \`number\` → numerisches Input · \`slider\` → Slider · \`string\` → Text-Input · \`color\` → Color-Input. Der Value-Typ jedes Feldes wird aus dem Descriptor abgeleitet — Consumer-Code sieht \`boolean\`, die Option-Value-Union, \`number\` oder \`string\` — nie \`unknown\`.`
                    },
                    custom: {
                        title: `Escape-Hatch: eigener Render`,
                        body: `Wenn kein eingebautes Primitive passt, definiere \`render: ({ value, setValue, t }) => …\` am Schema-Eintrag. Storage und typisierte Hooks bleiben geschenkt; nur die Zeilen-UI gehört dir.`
                    }
                },
                panel: {
                    title: `SettingsPanel-Integration`,
                    intro: `\`<SettingsPanel>\` rendert automatisch jedes registrierte Feld. Du schreibst keine Panel-UI — das Schema ist das Panel.`,
                    grouping: {
                        title: `Felder gruppieren`,
                        body: `Setze \`group: t => t.…\` pro Feld, um die Sektion zu steuern. Felder ohne Gruppe landen in einem übersetzten "Weitere"-Bucket. Reihenfolge innerhalb einer Gruppe folgt der Schema-Deklarationsreihenfolge.`
                    },
                    jsonExport: {
                        title: `JSON-Tab = vollständiger Export`,
                        body: `Der JSON-Tab des Panels bearbeitet den gesamten Blob — core + app — sodass ein Paste alles in einem Rutsch abdeckt. Save ruft \`settingsManager.replaceBlob(parsed)\`; der Versions-Check lehnt Pastes mit nicht passendem \`_v\` ab.`
                    }
                },
                storage: {
                    title: `Storage-Format & Migration`,
                    intro: `Wie der vereinheitlichte Blob auf Platte aussieht und wie Legacy-Installationen migrieren.`,
                    shape: {
                        title: `Blob-Format`,
                        body: `Drei Top-Level-Slots unter \`_v: 1\`: \`core\` (Theme, Sprache, Code-Editor, Map-Style, Toast), \`device\` (Hotkey-Overrides + Recent-Actions-MRU — absichtlich pro-Maschine) und \`app\`, gekeyed nach deinem \`appKey\`. Das literale JSON-Layout steht unten. Leere Slots fehlen einfach — Defaults greifen beim Lesen.`
                    },
                    migration: {
                        title: `Legacy-Keys werden automatisch migriert`,
                        body: `Ältere Versionen der Lib nutzten einen \`localStorage\`-Key pro Concern (\`_theme\`, \`_code_theme\`, \`_language\`, …). Beim ersten Mount mit dem neuen System werden diese Keys gelesen, in den neuen Blob gemerged und entfernt — einmalig. Der zweite Mount ist ein No-Op. Korrupte Legacy-JSON-Werte werden geloggt und übersprungen (die Lib fällt für diesen Slot auf den Default zurück).`
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
            steps: stepsDe,
            sectionHeading: sectionHeadingDe,
            pageIndex: pageIndexDe,
            audioPlayer: audioPlayerDe,
            lyrics: lyricsDe,
            fileIcon: fileIconDe,
            videoViewer: videoViewerDe,
            codeThemePicker: codeThemePickerDe,
            codeViewer: codeViewerDe,
            codeSnippet: codeSnippetDe,
            primaryMenu: primaryMenuDe,
            globalContextMenu: globalContextMenuDe,
            copyValueButton: copyValueButtonDe,
            buttonSelect: buttonSelectDe,
            settingsPanel: settingsPanelDe,
            historyPanel: historyPanelDe,
            terminal: terminalDe,
            logView: logViewDe,
            machineMonitor: machineMonitorDe,
            sidebar: sidebarDe,
            tabs: tabsDe,
            badge: badgeDe,
            button: buttonDe,
            card: cardDe,
            checkbox: checkboxDe,
            switch: switchDe,
            collapsible: collapsibleDe,
            input: inputDe,
            label: labelDe,
            textarea: textareaDe,
            skeleton: skeletonDe,
            progress: progressDe,
            dialog: dialogDe,
            popover: popoverDe,
            scrollArea: scrollAreaDe,
            radioGroup: radioGroupDe,
            slider: sliderDe,
            contextMenu: contextMenuDe,
            dropdownMenu: dropdownMenuDe,
            hoverCard: hoverCardDe,
            select: selectDe,
            sonner: sonnerDe,
            inputGroup: inputGroupDe,
            resizable: resizableDe,
            calendar: calendarDe,
            compass: compassDe,
            avatar: avatarDe,
            actionDisplay: actionDisplayDe,
            keyComboDisplay: keyComboDisplayDe,
            keyboardShortcutEditor: keyboardShortcutEditorDe,
            expandableCode: expandableCodeDe,
            expandableSection: expandableSectionDe,
            shareDialog: shareDialogDe,
            searchInput: searchInputDe,
            numberInput: numberInputDe,
            colorCurves: colorCurvesDe,
            optionPicker: optionPickerDe,
            searchSelectPicker: searchSelectPickerDe,
            languagePicker: languagePickerDe,
            themePicker: themePickerDe,
            mapStylePicker: mapStylePickerDe,
            map: mapDe,
            locationPicker: locationPickerDe,
            coordinateLinks: coordinateLinksDe,
            iconBadge: iconBadgeDe,
            dateTimePicker: dateTimePickerDe,
            timePicker: timePickerDe,
            timezoneSelector: timezoneSelectorDe,
            dateTimeRangePicker: dateTimeRangePickerDe,
            openingHours: openingHoursDe,
            loggingConfig: loggingConfigDe,
            inlineEdit: inlineEditDe,
            commandPalette: commandPaletteDe,
            modalHandler: modalHandlerDe,
            fileViewer: fileViewerDe,
            image360Viewer: image360ViewerDe,
            consoleManager: consoleManagerDe,
            timeline: timelineDe,
            nodeEditor: nodeEditorDe,
            dateTimeDisplay: dateTimeDisplayDe,
            resourceList: resourceListDe,
            emojiPicker: emojiPickerDe,
            chat: chatDe,
            keyComboRecorder: keyComboRecorderDe,
            chart: chartDe,
            weatherChip: weatherChipDe,
            weatherExpandable: weatherExpandableDe,
            staggeredCheckboxes: staggeredCheckboxesDe,
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
