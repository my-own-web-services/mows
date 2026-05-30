export interface StaggeredCheckboxesTranslation {
    default: { title: string; description: string };
    searchable: { title: string; description: string };
    selfOnly: { title: string; description: string };
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
            searchable: { title: string; description: string };
            selfOnly: { title: string; description: string };
        };
        definedBehaviour: {
            title: string;
            intro: string;
            verifiedBy: string;
            statements: {
                rendersCheckboxPerNode: string;
                togglingLeaf: string;
                checkingParentPropagates: string;
                uncheckingFullyCheckedParent: string;
                indeterminateWhenMixed: string;
                checkedWhenAll: string;
                indeterminateEscalates: string;
                searchFilters: string;
                emptyLabel: string;
                branchesCollapseExpand: string;
                disabledExcluded: string;
                cascadeSelfOnly: string;
                getNodeStateHelper: string;
                collectLeafIdsHelper: string;
            };
        };
        rtl: { title: string; body: string };
        apiReference: { title: string; intro: string };
    };
}

export const staggeredCheckboxesEn: StaggeredCheckboxesTranslation = {
    default: {
        title: `Hierarchy with tri-state`,
        description: `Clicking a parent checks every leaf descendant; an indeterminate parent shows the minus icon when only some descendants are checked.`
    },
    searchable: {
        title: `Searchable`,
        description: `The search box filters the tree to nodes whose label or extra keywords match the query; ancestors stay visible so the user can still see the path.`
    },
    selfOnly: {
        title: `cascade="selfOnly"`,
        description: `For permission-style trees where every node is a tracked id and parent clicks should not bulk-toggle descendants.`
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
            body: `<StaggeredCheckboxes> renders a tree of <Checkbox> nodes with three visual states: checked, unchecked, and indeterminate. The state of every parent is computed from its leaf descendants. The consumer owns the selection set; the component reads it and returns the next set on every click.`
        },
        composition: {
            title: `Composition`,
            body: `The component composes <Checkbox> with a <ChevronRight> disclosure button and <SearchInput> for filtering. Pass cascade="selfOnly" when parent clicks must not propagate to descendants (e.g. permission ids where the parent is a tracked entity in its own right).`
        },
        examples: {
            title: `Examples`,
            default: {
                title: `Hierarchy with tri-state`,
                description: `Default cascade mode. Two parents with nested children.`
            },
            searchable: {
                title: `Searchable`,
                description: `Live filter with extra keywords for synonym matches.`
            },
            selfOnly: {
                title: `cascade="selfOnly"`,
                description: `Parent and child each track their own id without bulk propagation.`
            }
        },
        definedBehaviour: {
            title: `Defined behaviour`,
            intro: `Statements describing how <StaggeredCheckboxes> is expected to behave, each linked to the test that verifies it.`,
            verifiedBy: `verified by`,
            statements: {
                rendersCheckboxPerNode: `Renders one checkbox per node in the tree.`,
                togglingLeaf: `Toggling a leaf updates only that id in the selection set.`,
                checkingParentPropagates: `Checking a parent propagates to every leaf descendant.`,
                uncheckingFullyCheckedParent: `Unchecking a fully-checked parent removes every leaf descendant.`,
                indeterminateWhenMixed: `Renders a parent in the indeterminate state when only some descendants are checked.`,
                checkedWhenAll: `Renders a parent as checked when every leaf descendant is checked.`,
                indeterminateEscalates: `Clicking an indeterminate parent escalates to fully checked.`,
                searchFilters: `Search filters the tree to matching nodes (case-insensitive).`,
                emptyLabel: `Renders the empty label when search has no matches.`,
                branchesCollapseExpand: `Branches collapse and expand via the disclosure button.`,
                disabledExcluded: `Disabled nodes are not togglable and are excluded from cascading writes.`,
                cascadeSelfOnly: `cascade="selfOnly" toggles just the clicked node.`,
                getNodeStateHelper: `getNodeState helper returns indeterminate when descendants disagree.`,
                collectLeafIdsHelper: `collectLeafIds returns every leaf descendant id.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Indentation switches sides under dir="rtl" via paddingInlineStart, and the disclosure chevron flips so it always rotates from "leading edge" to "down".`
        },
        apiReference: {
            title: `API Reference`,
            intro: `Props accepted by <StaggeredCheckboxes>.`
        }
    }
};

export const staggeredCheckboxesDe: StaggeredCheckboxesTranslation = {
    default: {
        title: `Hierarchie mit Tri-State`,
        description: `Ein Klick auf den Elternknoten markiert alle Blatt-Nachfahren; ein Elternknoten zeigt das Minus-Icon, sobald nur ein Teil seiner Nachfahren markiert ist.`
    },
    searchable: {
        title: `Mit Suche`,
        description: `Die Suche filtert den Baum auf Knoten, deren Label oder zusätzliche Stichworte zur Eingabe passen; Vorfahren bleiben sichtbar, damit der Pfad erkennbar bleibt.`
    },
    selfOnly: {
        title: `cascade="selfOnly"`,
        description: `Für Berechtigungsbäume, in denen jeder Knoten eine eigene ID ist und Elternklicks Nachfahren NICHT mit umschalten sollen.`
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
            body: `<StaggeredCheckboxes> rendert einen Baum aus <Checkbox>-Knoten mit drei Zuständen: gecheckt, ungecheckt und indeterminate. Der Zustand jedes Elternknotens ergibt sich aus den Blatt-Nachfahren. Der Konsument besitzt das Auswahl-Set; die Komponente liest es und liefert das nächste Set bei jedem Klick.`
        },
        composition: {
            title: `Komposition`,
            body: `Die Komponente kombiniert <Checkbox> mit einem <ChevronRight>-Disclosure-Button und <SearchInput> für die Filterung. cascade="selfOnly" verwenden, wenn Elternklicks nicht auf Nachfahren propagieren sollen (z. B. bei Berechtigungs-IDs, bei denen der Elternknoten selbst eine eigene Entität ist).`
        },
        examples: {
            title: `Beispiele`,
            default: {
                title: `Hierarchie mit Tri-State`,
                description: `Standard-Kaskade. Zwei Elternknoten mit verschachtelten Kindern.`
            },
            searchable: {
                title: `Mit Suche`,
                description: `Live-Filter mit zusätzlichen Stichworten für Synonyme.`
            },
            selfOnly: {
                title: `cascade="selfOnly"`,
                description: `Eltern und Kinder tracken jeweils ihre eigene ID, ohne Massentoggle.`
            }
        },
        definedBehaviour: {
            title: `Festgelegtes Verhalten`,
            intro: `Aussagen darüber, wie sich <StaggeredCheckboxes> verhalten soll, jeweils mit Verweis auf den Test.`,
            verifiedBy: `geprüft durch`,
            statements: {
                rendersCheckboxPerNode: `Rendert eine Checkbox pro Knoten im Baum.`,
                togglingLeaf: `Ein Toggle eines Blatts aktualisiert nur dessen ID im Auswahl-Set.`,
                checkingParentPropagates: `Das Markieren eines Elternknotens propagiert auf alle Blatt-Nachfahren.`,
                uncheckingFullyCheckedParent: `Das Abwählen eines vollständig markierten Elternknotens entfernt alle Blatt-Nachfahren.`,
                indeterminateWhenMixed: `Rendert den Elternknoten als indeterminate, sobald nur ein Teil der Nachfahren markiert ist.`,
                checkedWhenAll: `Rendert den Elternknoten als gecheckt, wenn alle Blatt-Nachfahren markiert sind.`,
                indeterminateEscalates: `Ein Klick auf einen indeterminate Elternknoten eskaliert auf vollständig gecheckt.`,
                searchFilters: `Die Suche filtert den Baum auf passende Knoten (case-insensitive).`,
                emptyLabel: `Rendert das Empty-Label, wenn die Suche keine Treffer hat.`,
                branchesCollapseExpand: `Äste lassen sich über den Disclosure-Button auf- und zuklappen.`,
                disabledExcluded: `Deaktivierte Knoten sind nicht toggle-bar und werden bei Kaskaden ausgeschlossen.`,
                cascadeSelfOnly: `cascade="selfOnly" togglet ausschließlich den geklickten Knoten.`,
                getNodeStateHelper: `getNodeState liefert indeterminate, wenn Nachfahren widersprechen.`,
                collectLeafIdsHelper: `collectLeafIds liefert alle Blatt-Nachfahren-IDs.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Die Einrückung wechselt unter dir="rtl" via paddingInlineStart die Seite, und der Disclosure-Chevron klappt korrekt vom führenden Rand nach unten.`
        },
        apiReference: {
            title: `API-Referenz`,
            intro: `Props, die <StaggeredCheckboxes> akzeptiert.`
        }
    }
};
