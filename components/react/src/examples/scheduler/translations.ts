import type { ExampleStrings } from "../harness/types";

export interface SchedulerTranslation {
    default: ExampleStrings;
    selection: ExampleStrings;
    agendaOnly: ExampleStrings;
    localized: ExampleStrings;
    businessHours: ExampleStrings;
    doc: {
        installation: {
            title: string;
            commandTab: string;
            manualTab: string;
            manualStep1: string;
            manualStep2: string;
            manualStep3: string;
        };
        examples: {
            title: string;
            default: ExampleStrings;
            selection: ExampleStrings;
            agendaOnly: ExampleStrings;
            localized: ExampleStrings;
            businessHours: ExampleStrings;
        };
        usage: { title: string; body: string };
        composition: { title: string; body: string };
        rtl: { title: string; body: string };
        definedBehaviour: {
            title: string;
            intro: string;
            verifiedBy: string;
            statements: {
                rendersViews: string;
                agendaLists: string;
                agendaEmpty: string;
                selectEvent: string;
                selectSlot: string;
                switchView: string;
                navigate: string;
            };
        };
        apiReference: { title: string; intro: string };
    };
}

export const schedulerEn: SchedulerTranslation = {
    default: {
        title: `Default`,
        description: `Month, week, day and agenda in one instance. Switch views from the toolbar, navigate with the arrows, and click an event or an empty slot.`
    },
    selection: {
        title: `Select, add & drag`,
        description: `Click an item for \`onSelectItem\`, empty space for \`onSelectSlot\`, or drag an \`editable\` item to reschedule it via \`onItemMove\`. The calendar stays a controlled display — you apply the change.`
    },
    agendaOnly: {
        title: `Agenda only`,
        description: `Restrict \`views\` to a single entry to hide the switcher — here a pure upcoming-events list for a narrow pane.`
    },
    localized: {
        title: `Localised`,
        description: `\`locale\` and \`weekStartsOn\` override the provider language per instance — US English with a Sunday-first week and 12-hour times.`
    },
    businessHours: {
        title: `Working hours`,
        description: `\`minHour\` / \`maxHour\` crop the time grid and \`slotMinutes\` sets the click-to-add granularity.`
    },
    doc: {
        installation: {
            title: `Installation`,
            commandTab: `Command`,
            manualTab: `Manual`,
            manualStep1: `Install the package with your package manager.`,
            manualStep2: `Import the component and feed it your already-expanded events.`,
            manualStep3: `Mount it inside a \`MowsProvider\` so the labels, week start and time format follow the active language.`
        },
        examples: {
            title: `Examples`,
            default: {
                title: `Default`,
                description: `All four views in one responsive instance.`
            },
            selection: {
                title: `Select, add & drag`,
                description: `Wiring \`onSelectItem\`, \`onSelectSlot\`, \`onItemMove\` and \`onCreate\`.`
            },
            agendaOnly: {
                title: `Agenda only`,
                description: `A single-view, list-only calendar.`
            },
            localized: {
                title: `Localised`,
                description: `Per-instance \`locale\` + \`weekStartsOn\`.`
            },
            businessHours: {
                title: `Working hours`,
                description: `A cropped, fine-grained time grid.`
            }
        },
        usage: {
            title: `Usage`,
            body: `Supply already-expanded \`events\` (expand any recurrences yourself). The calendar lays them out across month, week, day and agenda views and never mutates them.`
        },
        composition: {
            title: `Composition`,
            body: `The calendar fills its parent (min 30rem tall). Give it a sized container and drive view + date externally for a controlled calendar, or let it manage them.`
        },
        rtl: {
            title: `RTL`,
            body: `The grid, toolbar and agenda mirror correctly under \`dir="rtl"\`.`
        },
        definedBehaviour: {
            title: `Defined behaviour`,
            intro: `Guarantees covered by the component's test suite.`,
            verifiedBy: `Verified by`,
            statements: {
                rendersViews: `Renders month, week, day and agenda views, each with the right scaffolding.`,
                agendaLists: `Agenda groups events by day; the empty state shows when there are none.`,
                agendaEmpty: `An empty event set in agenda renders the "no events" state, not a blank panel.`,
                selectEvent: `Clicking an event calls onSelectItem with that event.`,
                selectSlot: `Clicking empty space calls onSelectSlot with the slot (all-day in month).`,
                switchView: `The toolbar switches views and reports onViewChange (uncontrolled).`,
                navigate: `The next/prev controls move the focused range and report onNavigate.`
            }
        },
        apiReference: {
            title: `API Reference`,
            intro: `Controlled or uncontrolled on both \`view\` and \`date\`.`
        }
    }
};

export const schedulerDe: SchedulerTranslation = {
    default: {
        title: `Standard`,
        description: `Monat, Woche, Tag und Agenda in einer Instanz. Ansicht über die Werkzeugleiste wechseln, mit den Pfeilen navigieren, einen Termin oder ein leeres Feld anklicken.`
    },
    selection: {
        title: `Auswählen, hinzufügen & ziehen`,
        description: `Klick auf einen Termin löst \`onSelectItem\` aus, Klick auf eine freie Stelle \`onSelectSlot\`, und das Ziehen eines \`editable\`-Termins verschiebt ihn über \`onItemMove\`. Der Kalender bleibt eine kontrollierte Anzeige — du wendest die Änderung an.`
    },
    agendaOnly: {
        title: `Nur Agenda`,
        description: `\`views\` auf einen Eintrag beschränken blendet die Umschaltung aus — hier eine reine Liste anstehender Termine für eine schmale Spalte.`
    },
    localized: {
        title: `Lokalisiert`,
        description: `\`locale\` und \`weekStartsOn\` überschreiben die App-Sprache pro Instanz — US-Englisch mit Sonntag als Wochenstart und 12-Stunden-Zeiten.`
    },
    businessHours: {
        title: `Arbeitszeiten`,
        description: `\`minHour\` / \`maxHour\` beschneiden das Zeitraster, \`slotMinutes\` legt die Raster­weite für das Klick-zum-Hinzufügen fest.`
    },
    doc: {
        installation: {
            title: `Installation`,
            commandTab: `Befehl`,
            manualTab: `Manuell`,
            manualStep1: `Installiere das Paket mit deinem Paketmanager.`,
            manualStep2: `Importiere die Komponente und übergib ihr deine bereits aufgelösten Termine.`,
            manualStep3: `Binde sie in einen \`MowsProvider\` ein, damit Beschriftungen, Wochenstart und Zeitformat der aktiven Sprache folgen.`
        },
        examples: {
            title: `Beispiele`,
            default: {
                title: `Standard`,
                description: `Alle vier Ansichten in einer responsiven Instanz.`
            },
            selection: {
                title: `Auswählen, hinzufügen & ziehen`,
                description: `\`onSelectItem\`, \`onSelectSlot\`, \`onItemMove\` und \`onCreate\` verdrahten.`
            },
            agendaOnly: {
                title: `Nur Agenda`,
                description: `Ein Kalender mit nur einer Listenansicht.`
            },
            localized: {
                title: `Lokalisiert`,
                description: `\`locale\` + \`weekStartsOn\` pro Instanz.`
            },
            businessHours: {
                title: `Arbeitszeiten`,
                description: `Ein beschnittenes, feingranulares Zeitraster.`
            }
        },
        usage: {
            title: `Verwendung`,
            body: `Übergib bereits aufgelöste \`events\` (Wiederholungen selbst expandieren). Der Kalender ordnet sie über Monats-, Wochen-, Tages- und Agenda-Ansicht an und verändert sie nie.`
        },
        composition: {
            title: `Komposition`,
            body: `Der Kalender füllt sein Elternelement (mind. 30rem hoch). Gib ihm einen Container mit Höhe und steuere Ansicht + Datum von außen für einen kontrollierten Kalender, oder lass ihn das selbst verwalten.`
        },
        rtl: {
            title: `RTL`,
            body: `Raster, Werkzeugleiste und Agenda spiegeln sich unter \`dir="rtl"\` korrekt.`
        },
        definedBehaviour: {
            title: `Definiertes Verhalten`,
            intro: `Garantien, die die Testsuite der Komponente abdeckt.`,
            verifiedBy: `Verifiziert durch`,
            statements: {
                rendersViews: `Rendert Monats-, Wochen-, Tages- und Agenda-Ansicht mit dem jeweils richtigen Gerüst.`,
                agendaLists: `Die Agenda gruppiert Termine nach Tag; der Leerzustand erscheint, wenn keine vorhanden sind.`,
                agendaEmpty: `Eine leere Terminmenge zeigt in der Agenda den „keine Termine“-Zustand statt eines leeren Panels.`,
                selectEvent: `Ein Klick auf einen Termin ruft onSelectItem mit diesem Termin auf.`,
                selectSlot: `Ein Klick auf eine freie Stelle ruft onSelectSlot mit dem Slot auf (ganztägig im Monat).`,
                switchView: `Die Werkzeugleiste wechselt Ansichten und meldet onViewChange (unkontrolliert).`,
                navigate: `Die Vor/Zurück-Steuerung verschiebt den Bereich und meldet onNavigate.`
            }
        },
        apiReference: {
            title: `API-Referenz`,
            intro: `Kontrolliert oder unkontrolliert für \`view\` und \`date\`.`
        }
    }
};
