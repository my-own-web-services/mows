/**
 * Translation slice for openingHours.
 *
 * Owns the type and both locale literals for this feature in one
 * place. Edits to openingHours's strings happen here; the top-level
 * Translation interface and locale files just reference these exports.
 */

export interface OpeningHoursTranslation {
    default: { title: string; description: string };
    collapsible: { title: string; description: string };
    closingSoon: { title: string; description: string };
    closed: { title: string; description: string };
    weekOnly: { title: string; description: string };
    rtl: { title: string; description: string };
    doc: {
        installation: {
            title: string;
            commandTab: string;
            manualTab: string;
            manualStep1: string;
            manualStep2: string;
            manualStep3: string;
        };
        usage: { title: string; body: string };
        composition: { title: string; body: string };
        examples: {
            title: string;
            default: { title: string; description: string };
            collapsible: { title: string; description: string };
            closingSoon: { title: string; description: string };
            closed: { title: string; description: string };
            weekOnly: { title: string; description: string };
        };
        osmFormat: {
            title: string;
            body: string;
            wikiLinkLabel: string;
            examplesHeading: string;
            examplesIntro: string;
            samples: ReadonlyArray<{ rule: string; meaning: string }>;
        };
        definedBehaviour: {
            title: string;
            intro: string;
            verifiedBy: string;
            statements: {
                emptyRules: string;
                garbageRules: string;
                openHeadline: string;
                closingSoonHeadline: string;
                closedHeadline: string;
                weekStrip: string;
                statusVariant: string;
                weekVariant: string;
                alwaysOpen: string;
                preParsedSchedule: string;
                crossMidnight: string;
                stringsOverride: string;
                collapsibleDefault: string;
                defaultOpen: string;
                localeFallback: string;
            };
        };
        rtl: { title: string; body: string };
        apiReference: { title: string; intro: string };
    };
}

export const openingHoursEn: OpeningHoursTranslation = {
    default: {
        title: `Default`,
        description: `Live status parsed from an OSM \`opening_hours\` value. The week table is collapsed behind a disclosure by default so the panel stays compact; click the row to reveal it.`
    },
    collapsible: {
        title: `Open by default`,
        description: `Pass \`defaultOpen\` to start with the week table visible. The header still toggles the disclosure — useful when the schedule is the primary fact on a page rather than a peripheral detail.`
    },
    closingSoon: {
        title: `Closing soon`,
        description: `When fewer than 60 minutes remain before close, the status switches to an amber "closing soon" tone with the exact close time.`
    },
    closed: {
        title: `Currently closed`,
        description: `A frozen reference time before the schedule opens — the status shows when the venue next opens.`
    },
    weekOnly: {
        title: `Week table only`,
        description: `\`variant="week"\` drops the status line and renders just the seven-day grid, useful inside a tab or expandable panel that already shows status elsewhere.`
    },
    rtl: {
        title: `Right-to-left`,
        description: `Wrapped in \`dir="rtl"\`, the chrome mirrors but \`HH:mm\` intervals stay left-to-right per Intl conventions.`
    },
    doc: {
        installation: {
            title: `Installation`,
            commandTab: `Command`,
            manualTab: `Manual`,
            manualStep1: `Install the following dependencies:`,
            manualStep2: `Copy and paste the following code into your project.`,
            manualStep3: `Update the import paths to match your project setup.`
        },
        usage: {
            title: `Usage`,
            body: `Pass a raw OSM \`opening_hours\` string via \`rules\`. The component parses it with the canonical \`opening_hours.js\` library, derives the live status, and renders a seven-day schedule strip behind a disclosure.`
        },
        composition: {
            title: `Composition`,
            body: `The default \`variant="full"\` shows the status pill as the always-visible trigger and reveals the week table on toggle. Pass \`collapsible={false}\` to render both halves inline at all times, or \`variant="status"\` / \`variant="week"\` to render just one half. Pre-parse via \`parseOsmOpeningHoursSchedule\` and pass through \`schedule\` to keep parsing off the render path.`
        },
        examples: {
            title: `Examples`,
            default: {
                title: `Default`,
                description: `Status pill with the week table tucked behind a disclosure — the most common shape for a place / business panel.`
            },
            collapsible: {
                title: `Open by default`,
                description: `\`defaultOpen\` starts the disclosure expanded so the week table is visible up-front while the header still toggles it shut.`
            },
            closingSoon: {
                title: `Closing soon`,
                description: `Amber tone when the rule closes within an hour of \`now\`.`
            },
            closed: {
                title: `Currently closed`,
                description: `Closed status with the next opening surfaced as a "opens at" detail.`
            },
            weekOnly: {
                title: `Week table only`,
                description: `Schedule grid without the status pill, useful for grouped panels.`
            }
        },
        osmFormat: {
            title: `OSM \`opening_hours\` format`,
            body: `\`rules\` is a raw \`opening_hours\` string in the syntax defined by OpenStreetMap. It is parsed by the canonical \`opening_hours.js\` library, so anything that library accepts will work here — including weekday ranges, multiple intervals per day, public-holiday flags (\`PH\`), and \`24/7\`.`,
            wikiLinkLabel: `OSM wiki: Key:opening_hours`,
            examplesHeading: `Common shapes`,
            examplesIntro: `A handful of common rules. Every value below is a valid \`rules\` prop.`,
            samples: [
                { rule: `24/7`, meaning: `Always open.` },
                { rule: `Mo-Fr 09:00-18:00`, meaning: `Weekdays only, 9 to 6.` },
                { rule: `Mo-Fr 09:00-18:00; Sa 10:00-14:00`, meaning: `Weekdays plus a shorter Saturday window.` },
                { rule: `Mo-Sa 07:00-12:00,14:00-19:00`, meaning: `Split day — morning and afternoon shifts.` },
                { rule: `Mo-Sa 07:00-20:00; PH,Su off`, meaning: `Closed on Sundays and public holidays.` },
                { rule: `Mar-Oct 08:00-20:00`, meaning: `Seasonal — only between March and October.` }
            ]
        },
        definedBehaviour: {
            title: `Defined behaviour`,
            intro: `Statements about how \`<OpeningHours>\` should behave, each referencing the test that enforces it.`,
            verifiedBy: `Verified by`,
            statements: {
                emptyRules: `Renders nothing when \`rules\` is empty.`,
                garbageRules: `Renders nothing when \`rules\` is unparsable.`,
                openHeadline: `Shows the "Open" headline and a "closes at HH:mm" detail when currently open.`,
                closingSoonHeadline: `Switches to the "Closing soon" tone when fewer than 60 minutes remain.`,
                closedHeadline: `Shows the "Closed" headline and an "opens at HH:mm" detail when currently closed.`,
                weekStrip: `Renders a seven-row week with exactly one row flagged as today.`,
                statusVariant: `\`variant="status"\` omits the week table.`,
                weekVariant: `\`variant="week"\` omits the status line.`,
                alwaysOpen: `Uses the "Open 24/7" headline when the rule is \`24/7\`.`,
                preParsedSchedule: `Accepts a pre-parsed \`schedule\` and skips internal parsing.`,
                crossMidnight: `Clamps cross-midnight intervals so they render as 22:00–24:00 on day N and 00:00–02:00 on day N+1.`,
                stringsOverride: `Honours \`strings\` overrides for headline and detail, including \`{time}\` placeholders.`,
                collapsibleDefault: `Hides the week table behind a disclosure by default and only mounts it once the trigger has been activated.`,
                defaultOpen: `\`defaultOpen\` starts the disclosure expanded so the week table is visible on first render.`,
                localeFallback: `Falls back to the bundled translation for the active locale (currently English + German) when no \`strings\` prop is supplied.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Under \`dir="rtl"\` the chrome mirrors but the \`HH:mm\` intervals themselves remain left-to-right — they follow Intl's BIDI rules, not the surrounding flex direction.`
        },
        apiReference: {
            title: `API Reference`,
            intro: `Props accepted by \`<OpeningHours>\`.`
        }
    }
};

export const openingHoursDe: OpeningHoursTranslation = {
    default: {
        title: `Standard`,
        description: `Live-Status aus einem OSM-\`opening_hours\`-Wert. Die Wochentabelle ist standardmäßig hinter einer Klappung verborgen, damit das Panel kompakt bleibt; per Klick auf den Header erscheint sie.`
    },
    collapsible: {
        title: `Standardmäßig geöffnet`,
        description: `\`defaultOpen\` startet mit sichtbarer Wochentabelle. Der Header schaltet die Klappung weiterhin um — sinnvoll, wenn der Fahrplan die zentrale Information einer Seite ist und nicht nur ein Randdetail.`
    },
    closingSoon: {
        title: `Schließt bald`,
        description: `Wenn weniger als 60 Minuten bis zum Schluss bleiben, wechselt der Status in einen bernsteinfarbenen "Schließt bald"-Ton mit exakter Schließzeit.`
    },
    closed: {
        title: `Aktuell geschlossen`,
        description: `Ein fixer Referenzzeitpunkt vor der Öffnung — der Status zeigt, wann das Lokal das nächste Mal öffnet.`
    },
    weekOnly: {
        title: `Nur Wochentabelle`,
        description: `\`variant="week"\` blendet die Statuszeile aus und zeigt nur das 7-Tage-Raster — passend für Tabs oder ausklappbare Panels, die den Status anderswo darstellen.`
    },
    rtl: {
        title: `Rechts-nach-links`,
        description: `Unter \`dir="rtl"\` spiegelt das Chrome, doch \`HH:mm\`-Intervalle bleiben gemäß Intl-Konvention von links nach rechts.`
    },
    doc: {
        installation: {
            title: `Installation`,
            commandTab: `Befehl`,
            manualTab: `Manuell`,
            manualStep1: `Installiere die folgenden Abhängigkeiten:`,
            manualStep2: `Kopiere den folgenden Code in dein Projekt.`,
            manualStep3: `Passe die Import-Pfade an dein Projekt an.`
        },
        usage: {
            title: `Verwendung`,
            body: `Übergib einen rohen OSM-\`opening_hours\`-String über \`rules\`. Die Komponente parst ihn mit der kanonischen \`opening_hours.js\`-Bibliothek, leitet den Live-Status ab und rendert eine 7-Tage-Übersicht hinter einer Klappung.`
        },
        composition: {
            title: `Komposition`,
            body: `Die Voreinstellung \`variant="full"\` zeigt die Statuszeile als immer sichtbaren Trigger und blendet die Wochentabelle erst beim Aufklappen ein. Mit \`collapsible={false}\` rendern beide Hälften dauerhaft inline; \`variant="status"\` bzw. \`variant="week"\` zeigt nur eine Hälfte. Mit \`parseOsmOpeningHoursSchedule\` kannst du vorab parsen und das Ergebnis über \`schedule\` übergeben, um Parsing aus dem Render-Pfad zu halten.`
        },
        examples: {
            title: `Beispiele`,
            default: {
                title: `Standard`,
                description: `Status-Pille mit Wochentabelle hinter einer Klappung — die übliche Form in Orts- / Geschäftspanels.`
            },
            collapsible: {
                title: `Standardmäßig geöffnet`,
                description: `\`defaultOpen\` startet die Klappung aufgeklappt, sodass die Wochentabelle sofort sichtbar ist; der Header schaltet weiterhin um.`
            },
            closingSoon: {
                title: `Schließt bald`,
                description: `Bernsteinfarbener Ton, wenn die Regel innerhalb einer Stunde von \`now\` schließt.`
            },
            closed: {
                title: `Aktuell geschlossen`,
                description: `Geschlossen-Status; die nächste Öffnung erscheint als "öffnet um"-Detail.`
            },
            weekOnly: {
                title: `Nur Wochentabelle`,
                description: `Wochenraster ohne Status-Pille, für gruppierte Panels.`
            }
        },
        osmFormat: {
            title: `OSM-\`opening_hours\`-Format`,
            body: `\`rules\` ist ein roher \`opening_hours\`-String in der von OpenStreetMap definierten Syntax. Geparst wird mit der kanonischen \`opening_hours.js\`-Bibliothek, also funktioniert alles, was diese Bibliothek akzeptiert — inklusive Wochentagsbereichen, mehreren Intervallen pro Tag, Feiertagsflag (\`PH\`) und \`24/7\`.`,
            wikiLinkLabel: `OSM-Wiki: Key:opening_hours`,
            examplesHeading: `Häufige Formen`,
            examplesIntro: `Einige typische Regeln. Jeder Wert unten ist ein gültiger \`rules\`-Prop.`,
            samples: [
                { rule: `24/7`, meaning: `Durchgehend geöffnet.` },
                { rule: `Mo-Fr 09:00-18:00`, meaning: `Nur werktags, 9 bis 18 Uhr.` },
                { rule: `Mo-Fr 09:00-18:00; Sa 10:00-14:00`, meaning: `Werktags plus kürzeres Samstagsfenster.` },
                { rule: `Mo-Sa 07:00-12:00,14:00-19:00`, meaning: `Geteilter Tag — Vor- und Nachmittagsschicht.` },
                { rule: `Mo-Sa 07:00-20:00; PH,Su off`, meaning: `Sonn- und feiertags geschlossen.` },
                { rule: `Mar-Oct 08:00-20:00`, meaning: `Saisonal — nur zwischen März und Oktober.` }
            ]
        },
        definedBehaviour: {
            title: `Festgelegtes Verhalten`,
            intro: `Aussagen darüber, wie sich \`<OpeningHours>\` verhalten soll, jeweils mit Verweis auf den Test, der das absichert.`,
            verifiedBy: `Geprüft durch`,
            statements: {
                emptyRules: `Rendert nichts, wenn \`rules\` leer ist.`,
                garbageRules: `Rendert nichts, wenn \`rules\` nicht geparst werden kann.`,
                openHeadline: `Zeigt die "Geöffnet"-Überschrift und ein "schließt um HH:mm"-Detail, wenn aktuell geöffnet.`,
                closingSoonHeadline: `Wechselt in den "Schließt bald"-Ton, wenn weniger als 60 Minuten bleiben.`,
                closedHeadline: `Zeigt die "Geschlossen"-Überschrift und ein "öffnet um HH:mm"-Detail, wenn aktuell geschlossen.`,
                weekStrip: `Rendert sieben Zeilen für die Woche; genau eine ist als heutiger Tag markiert.`,
                statusVariant: `\`variant="status"\` blendet die Wochentabelle aus.`,
                weekVariant: `\`variant="week"\` blendet die Statuszeile aus.`,
                alwaysOpen: `Verwendet die "Durchgehend geöffnet"-Überschrift für die Regel \`24/7\`.`,
                preParsedSchedule: `Akzeptiert ein vorab geparstes \`schedule\` und überspringt das interne Parsen.`,
                crossMidnight: `Klammert Intervalle über Mitternacht, sodass sie als 22:00–24:00 an Tag N und 00:00–02:00 an Tag N+1 erscheinen.`,
                stringsOverride: `Berücksichtigt \`strings\`-Overrides für Überschrift und Detail inklusive \`{time}\`-Platzhaltern.`,
                collapsibleDefault: `Versteckt die Wochentabelle standardmäßig hinter einer Klappung und mountet sie erst, wenn der Trigger ausgelöst wurde.`,
                defaultOpen: `\`defaultOpen\` startet die Klappung aufgeklappt, sodass die Wochentabelle beim ersten Rendern sichtbar ist.`,
                localeFallback: `Fällt auf die mitgelieferte Übersetzung der aktiven Sprache zurück (aktuell Englisch + Deutsch), wenn kein \`strings\`-Prop übergeben wurde.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Unter \`dir="rtl"\` spiegelt das Chrome, die \`HH:mm\`-Intervalle bleiben jedoch links-nach-rechts — sie folgen den Intl-BIDI-Regeln, nicht der umgebenden Flex-Richtung.`
        },
        apiReference: {
            title: `API-Referenz`,
            intro: `Props, die \`<OpeningHours>\` akzeptiert.`
        }
    }
};
