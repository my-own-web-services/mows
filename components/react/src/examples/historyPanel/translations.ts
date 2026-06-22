/**
 * Translation slice for the HistoryPanel example.
 *
 * Owns the type and both locale literals for the panel's doc page +
 * example modes. Keeps strings out of the global `Translation` schema —
 * `src/languages.ts` references this slice once, and the locale files
 * register the en + de literals.
 */

export interface HistoryPanelTranslation {
    default: { title: string; description: string };
    filtered: { title: string; description: string };
    empty: { title: string; description: string };
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
            default: { title: string; description: string };
            filtered: { title: string; description: string };
            empty: { title: string; description: string };
        };
        usage: { title: string; body: string };
        composition: { title: string; body: string };
        rtl: { title: string; body: string };
        definedBehaviour: {
            title: string;
            intro: string;
            verifiedBy: string;
            statements: {
                emptyState: string;
                newestFirst: string;
                searchFilters: string;
                undoToHereInvokes: string;
                otherTabMuted: string;
                unknownActionFallback: string;
                clearTwoStep: string;
                xssSafe: string;
            };
        };
        apiReference: { title: string; intro: string };
    };
}

export const historyPanelEn: HistoryPanelTranslation = {
    default: {
        title: `Default`,
        description: `A populated history with several undoable entries. Each row shows the action label, a timestamp, and — for entries from this tab whose handler is still registered — an "Undo to here" button.`
    },
    filtered: {
        title: `Filtered`,
        description: `Same data, with the search box and category filter narrowing the visible rows. Filters compose: the visible list is intersected, not appended.`
    },
    empty: {
        title: `Empty`,
        description: `What the panel looks like before any action is dispatched. The empty-state copy is the only visible content.`
    },
    doc: {
        installation: {
            title: `Installation`,
            commandTab: `Command`,
            manualTab: `Manual`,
            manualStep1: `Install the package.`,
            manualStep2: `Mount the panel by registering the open action — it lives behind \`mows.history.open\` and renders inside the modal handler.`,
            manualStep3: `Bind \`mod+z\` / \`mod+shift+z\` by default; \`mows.history.open\` has no default hotkey so each app decides whether to expose it from the primary menu, a button, or a custom binding.`
        },
        examples: {
            title: `Examples`,
            default: {
                title: `Populated history`,
                description: `Dispatch a few undoable actions, then open the panel.`
            },
            filtered: {
                title: `With search + filter`,
                description: `Same dataset under an active search query and category filter.`
            },
            empty: {
                title: `Empty state`,
                description: `Before any action is dispatched the panel renders only the empty-state copy.`
            }
        },
        usage: {
            title: `Usage`,
            body: `Open the panel by dispatching \`mows.history.open\`. Listing rebuilds from \`actionManager.getAuditLog()\` whenever the manager notifies subscribers — which it does on every dispatch, undo, redo, and clear.`
        },
        composition: {
            title: `Composition`,
            body: `\`<HistoryPanel>\` is mounted by \`<ModalHandler>\` under the \`history\` modal key. Apps that don't use the modal handler can render it directly inside their own dialog — it has no internal modal chrome.`
        },
        rtl: {
            title: `Right-to-left`,
            body: `Layout is direction-agnostic — the row content is laid out with flex gap, not directional margins, so the panel mirrors correctly under \`dir="rtl"\`.`
        },
        definedBehaviour: {
            title: `Defined behaviour`,
            intro: `Each statement below is verified by a test in the linked file.`,
            verifiedBy: `Verified by`,
            statements: {
                emptyState: `Renders the empty-state copy when the audit log is empty.`,
                newestFirst: `Renders one row per audit entry, newest first.`,
                searchFilters: `Filters by the search box (case-insensitive substring match).`,
                undoToHereInvokes: `Clicking "Undo to here" invokes the handler's invertAction.`,
                otherTabMuted: `Renders entries from other tabs muted, with no "Undo to here" button.`,
                unknownActionFallback: `Renders entries for unknown actions with the literal id and a dimmed style.`,
                clearTwoStep: `The clear button is two-step: first click arms a confirmation, second click clears.`,
                xssSafe: `Renders \`describe.params\` via React text — never as raw markup (XSS-safe).`
            }
        },
        apiReference: {
            title: `API reference`,
            intro: `The panel takes no required props. It reads from the surrounding \`<MowsProvider>\`'s ActionManager.`
        }
    }
};

export const historyPanelDe: HistoryPanelTranslation = {
    default: {
        title: `Standard`,
        description: `Eine bestückte Verlaufsliste mit mehreren rückgängig-fähigen Einträgen. Jede Zeile zeigt das Label, einen Zeitstempel und — für Einträge aus diesem Tab mit noch registriertem Handler — eine „Bis hierhin rückgängig"-Schaltfläche.`
    },
    filtered: {
        title: `Gefiltert`,
        description: `Dieselben Daten, mit aktiver Suche und Kategorie-Filter. Filter wirken zusammen (Schnittmenge, nicht Vereinigung).`
    },
    empty: {
        title: `Leer`,
        description: `Wie das Panel vor dem ersten Dispatch aussieht. Nur der Leertext ist sichtbar.`
    },
    doc: {
        installation: {
            title: `Installation`,
            commandTab: `Befehl`,
            manualTab: `Manuell`,
            manualStep1: `Paket installieren.`,
            manualStep2: `Panel öffnen über die \`mows.history.open\`-Aktion — sie wird vom Modal-Handler gerendert.`,
            manualStep3: `\`mod+z\` / \`mod+shift+z\` sind voreingestellt; \`mows.history.open\` hat keinen Standard-Hotkey, jede App entscheidet selbst, wie sie ihn anbietet.`
        },
        examples: {
            title: `Beispiele`,
            default: {
                title: `Bestückter Verlauf`,
                description: `Einige rückgängig-fähige Aktionen ausführen, dann das Panel öffnen.`
            },
            filtered: {
                title: `Mit Suche + Filter`,
                description: `Derselbe Datensatz mit aktivem Suchbegriff und Kategorie-Filter.`
            },
            empty: {
                title: `Leerzustand`,
                description: `Vor dem ersten Dispatch zeigt das Panel nur den Leertext.`
            }
        },
        usage: {
            title: `Verwendung`,
            body: `Panel öffnen mit \`mows.history.open\`. Die Liste wird bei jedem Subscriber-Trigger neu aus \`actionManager.getAuditLog()\` gebaut — Dispatch, Undo, Redo und Clear lösen das aus.`
        },
        composition: {
            title: `Komposition`,
            body: `\`<HistoryPanel>\` wird vom \`<ModalHandler>\` unter dem \`history\`-Schlüssel gerendert. Apps ohne den Modal-Handler können es direkt in einen eigenen Dialog einbinden — das Panel hat keine eigene Modal-Hülle.`
        },
        rtl: {
            title: `Rechts-nach-links`,
            body: `Layout ist richtungsneutral — Flex-Gap statt direktionaler Margins, daher spiegelt das Panel unter \`dir="rtl"\` korrekt.`
        },
        definedBehaviour: {
            title: `Definiertes Verhalten`,
            intro: `Jede Aussage unten ist durch einen Test in der verlinkten Datei abgedeckt.`,
            verifiedBy: `Abgesichert von`,
            statements: {
                emptyState: `Zeigt den Leertext, wenn das Audit-Log leer ist.`,
                newestFirst: `Rendert eine Zeile pro Audit-Eintrag, neueste zuerst.`,
                searchFilters: `Filtert über die Suchbox (Teilstring-Vergleich, Groß-/Kleinschreibung egal).`,
                undoToHereInvokes: `„Bis hierhin rückgängig" ruft die invertAction des Handlers auf.`,
                otherTabMuted: `Einträge aus anderen Tabs werden ausgegraut, ohne „Bis hierhin"-Button.`,
                unknownActionFallback: `Einträge unbekannter Aktionen werden mit dem rohen Aktions-Identifier und gedimmt dargestellt.`,
                clearTwoStep: `Der Löschen-Knopf ist zweistufig — erster Klick fordert Bestätigung, zweiter löscht.`,
                xssSafe: `Rendert \`describe.params\` als React-Text — niemals als rohes Markup (XSS-sicher).`
            }
        },
        apiReference: {
            title: `API-Referenz`,
            intro: `Das Panel hat keine erforderlichen Props. Es liest aus dem umgebenden \`<MowsProvider>\`-ActionManager.`
        }
    }
};
