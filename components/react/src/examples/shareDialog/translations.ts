export interface ShareDialogTranslation {
    default: { title: string; description: string };
    allowDeny: { title: string; description: string };
    publicOnly: { title: string; description: string };
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
            allowDeny: { title: string; description: string };
            publicOnly: { title: string; description: string };
        };
        definedBehaviour: {
            title: string;
            intro: string;
            verifiedBy: string;
            statements: {
                rendersResourceLabel: string;
                tabPerSubjectKind: string;
                hidesEmptyKindTabs: string;
                excludesSubjectIds: string;
                impliedActionsAutoCheck: string;
                uncheckDoesNotCascade: string;
                blocksWithoutSubject: string;
                blocksWithoutAction: string;
                actionsOrderedByProp: string;
                allowDenyToggleGated: string;
                publicSentinelAutoSelects: string;
                surfaceErrorOnReject: string;
                resetsOnReopen: string;
            };
        };
        rtl: { title: string; body: string };
        apiReference: { title: string; intro: string };
    };
}

export const shareDialogEn: ShareDialogTranslation = {
    default: {
        title: `Cross-subject share`,
        description: `Three subject kinds offered — User, UserGroup, ServerMember. Read implies List so checking Read also checks List. The dialog hands the materialised policy intent back via onShare; no consumer-service imports.`
    },
    allowDeny: {
        title: `Allow / Deny toggle`,
        description: `Pass allowDeny to expose the Deny radio — useful for overrides that should beat any Allow the engine would otherwise pin. Off by default because Deny is a power-user concept.`
    },
    publicOnly: {
        title: `Public sentinel only`,
        description: `When only one subject kind is supplied, no tab bar is needed — the kind takes the whole panel. The Public sentinel auto-selects so submitting works without an extra interaction.`
    },
    rtl: {
        title: `Right-to-left`,
        description: `Same dialog under dir="rtl" with Arabic translations supplied via the strings prop. Tabs, picker, action list, and footer flip with the document direction; the i18n-neutral string surface means callers don't import a translation table.`
    },
    doc: {
        installation: {
            title: `Installation`,
            commandTab: `Package manager`,
            manualTab: `Manual`,
            manualStep1: `Install the package alongside its peer dependencies (React 19, Tailwind 4).`,
            manualStep2: `Render the dialog where you need it — props are entirely callback-driven so no provider is required.`,
            manualStep3: `Run the share dialog inside your own modal / context-menu surface. Closing on cancel + on successful share are wired automatically.`
        },
        usage: {
            title: `Usage`,
            body: `Pass the list of subjects the caller can share with + the per-consumer action vocabulary. The dialog never queries an upstream — your onShare callback turns the submission into the actual API call.`
        },
        composition: {
            title: `Composition`,
            body: `Drive open/close yourself, supply subjects + actions per-resource, and translate strings via the optional strings prop. Implication closure is computed once per actions prop change.`
        },
        examples: {
            title: `Examples`,
            default: {
                title: `Cross-subject default`,
                description: `User + UserGroup + ServerMember tabs. Demonstrates implication propagation (Read implies List).`
            },
            allowDeny: {
                title: `Allow / Deny toggle`,
                description: `Adds the effect radio for cases where Deny precedence is meaningful. Without allowDeny, every submission is Allow.`
            },
            publicOnly: {
                title: `Public-only sentinel`,
                description: `Single-kind shortcut: only Public is offered, no tab bar needed. The Public sentinel auto-selects on open.`
            }
        },
        definedBehaviour: {
            title: `Defined behaviour`,
            intro: `Each statement below is pinned by a test in ShareDialog.test.tsx — the dialog's contract with callers.`,
            verifiedBy: `Verified by`,
            statements: {
                rendersResourceLabel: `Renders the resourceLabel in the dialog title.`,
                tabPerSubjectKind: `Surfaces every subject kind that has at least one option as its own tab.`,
                hidesEmptyKindTabs: `Does NOT render a tab for a subject kind with zero options.`,
                excludesSubjectIds: `Filters out subject ids passed via excludeSubjectIds (the acting-user filter).`,
                impliedActionsAutoCheck: `Checking an action auto-checks every action in its implication closure.`,
                uncheckDoesNotCascade: `Unchecking an implied action does NOT cascade back through the implication graph.`,
                blocksWithoutSubject: `Refuses to submit until a subject is picked — surfaces the inline error and never calls onShare.`,
                blocksWithoutAction: `Refuses to submit until at least one action is checked.`,
                actionsOrderedByProp: `Returns selected action ids in the order defined by the actions prop, not click order.`,
                allowDenyToggleGated: `Shows the Allow / Deny effect toggle only when allowDeny is true.`,
                publicSentinelAutoSelects: `Auto-selects the sentinel subject the first time a Public-only tab is shown.`,
                surfaceErrorOnReject: `Keeps the dialog open and renders the error message inline when onShare rejects.`,
                resetsOnReopen: `Resets selectedSubject / selectedActionIds / effect each time the dialog re-opens.`
            }
        },
        rtl: {
            title: `Right-to-left`,
            body: `Renders verbatim under dir="rtl" — tabs, picker, action list, and footer flip with the document direction; no per-component RTL toggle needed.`
        },
        apiReference: {
            title: `API Reference`,
            intro: `Public props of <ShareDialog>. Subject / action option shapes live next to the component as ShareSubjectOption / ShareActionOption — see the types file for the full surface.`
        }
    }
};

export const shareDialogDe: ShareDialogTranslation = {
    default: {
        title: `Subjekt-übergreifendes Teilen`,
        description: `Drei Subjekt-Arten angeboten — User, UserGroup, ServerMember. Read impliziert List, daher wird List automatisch mit angehakt. Die Übermittlung läuft als reine Daten über onShare; keine Consumer-Service-Imports.`
    },
    allowDeny: {
        title: `Allow / Deny Schalter`,
        description: `Mit allowDeny erscheint das Deny-Radio — sinnvoll für Overrides, die jede Allow-Regel der Engine schlagen sollen. Standardmäßig aus, weil Deny ein Power-User-Konzept ist.`
    },
    publicOnly: {
        title: `Nur Public-Sentinel`,
        description: `Wird nur eine Subjekt-Art übergeben, entfällt die Tab-Leiste — die Art belegt das ganze Panel. Der Public-Sentinel wird automatisch ausgewählt, damit das Absenden ohne Zusatzklick funktioniert.`
    },
    rtl: {
        title: `Rechts-nach-links`,
        description: `Derselbe Dialog unter dir="rtl" mit arabischen Übersetzungen via strings-Prop. Tabs, Picker, Action-Liste und Footer spiegeln sich mit der Dokumentenrichtung; die i18n-neutrale Strings-Oberfläche heißt, dass Aufrufer keine Übersetzungstabelle importieren müssen.`
    },
    doc: {
        installation: {
            title: `Installation`,
            commandTab: `Paket-Manager`,
            manualTab: `Manuell`,
            manualStep1: `Installiere das Paket inkl. Peer-Dependencies (React 19, Tailwind 4).`,
            manualStep2: `Render den Dialog wo nötig — alle Props sind Callback-getrieben, kein Provider erforderlich.`,
            manualStep3: `Betreibe den Dialog innerhalb deines Modal-/Context-Menu-Surfaces. Schließen bei Abbruch und nach erfolgreichem Submit ist automatisch verdrahtet.`
        },
        usage: {
            title: `Verwendung`,
            body: `Übergib die Subjekt-Liste, mit der der Caller teilen darf, plus das pro Consumer gültige Action-Vokabular. Der Dialog spricht keinen Upstream selbst an — dein onShare-Callback übersetzt die Eingabe in den tatsächlichen API-Aufruf.`
        },
        composition: {
            title: `Komposition`,
            body: `Steuere open/close selbst, liefere subjects + actions pro Ressource, und übersetze Strings via optionalem strings-Prop. Die Implikations-Hülle wird einmal pro actions-Änderung berechnet.`
        },
        examples: {
            title: `Beispiele`,
            default: {
                title: `Subjekt-übergreifend Default`,
                description: `User + UserGroup + ServerMember Tabs. Zeigt Implikations-Propagation (Read impliziert List).`
            },
            allowDeny: {
                title: `Allow / Deny Schalter`,
                description: `Fügt das Effect-Radio für Fälle hinzu, in denen Deny-Präzedenz wichtig ist. Ohne allowDeny ist jede Übermittlung Allow.`
            },
            publicOnly: {
                title: `Nur Public-Sentinel`,
                description: `Einzel-Arten-Kurzform: Nur Public wird angeboten, keine Tab-Leiste nötig. Der Public-Sentinel wird beim Öffnen vorausgewählt.`
            }
        },
        definedBehaviour: {
            title: `Definiertes Verhalten`,
            intro: `Jede Aussage wird durch einen Test in ShareDialog.test.tsx abgesichert — der Vertrag des Dialogs mit Aufrufern.`,
            verifiedBy: `Verifiziert durch`,
            statements: {
                rendersResourceLabel: `Zeigt das resourceLabel im Dialog-Titel.`,
                tabPerSubjectKind: `Jede Subjekt-Art mit mindestens einer Option bekommt einen eigenen Tab.`,
                hidesEmptyKindTabs: `Eine Subjekt-Art ohne Optionen bekommt KEINEN Tab.`,
                excludesSubjectIds: `Filtert via excludeSubjectIds übergebene Subjekt-IDs heraus (Acting-User-Filter).`,
                impliedActionsAutoCheck: `Das Anhaken einer Action hakt automatisch alle Actions ihrer Implikations-Hülle mit.`,
                uncheckDoesNotCascade: `Das Abhaken einer implizierten Action propagiert NICHT zurück durch den Implikations-Graph.`,
                blocksWithoutSubject: `Lehnt das Senden ab, bis ein Subjekt ausgewählt ist — zeigt Inline-Fehler und ruft onShare nie auf.`,
                blocksWithoutAction: `Lehnt das Senden ab, bis mindestens eine Action angehakt ist.`,
                actionsOrderedByProp: `Liefert ausgewählte Action-IDs in der Reihenfolge des actions-Props, nicht Klick-Reihenfolge.`,
                allowDenyToggleGated: `Zeigt den Allow / Deny Effect-Toggle nur, wenn allowDeny true ist.`,
                publicSentinelAutoSelects: `Wählt den Sentinel-Subjekt beim ersten Anzeigen eines Public-only-Tabs automatisch.`,
                surfaceErrorOnReject: `Hält den Dialog offen und zeigt Fehlermeldung inline, wenn onShare rejected.`,
                resetsOnReopen: `Setzt selectedSubject / selectedActionIds / effect bei jedem erneuten Öffnen zurück.`
            }
        },
        rtl: {
            title: `Rechts-nach-links`,
            body: `Rendert wortwörtlich unter dir="rtl" — Tabs, Picker, Action-Liste und Footer spiegeln sich mit der Dokumentenrichtung; kein component-spezifischer RTL-Toggle nötig.`
        },
        apiReference: {
            title: `API-Referenz`,
            intro: `Öffentliche Props von <ShareDialog>. Subjekt-/Action-Optionen-Shapes liegen beim Component als ShareSubjectOption / ShareActionOption — siehe types.ts für die volle Oberfläche.`
        }
    }
};
