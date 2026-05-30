export interface ExpandableSectionTranslation {
    default: { title: string; description: string };
    stack: { title: string; description: string };
    controlled: { title: string; description: string };
    disabled: { title: string; description: string };
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
            stack: { title: string; description: string };
            controlled: { title: string; description: string };
            disabled: { title: string; description: string };
        };
        definedBehaviour: {
            title: string;
            intro: string;
            verifiedBy: string;
            statements: {
                collapsedByDefault: string;
                opensOnClick: string;
                firesOnOpenChange: string;
                controllableOpen: string;
                defaultOpen: string;
                ariaLabelPerState: string;
                disabledDoesNotExpand: string;
                disabledHasNoAriaLabel: string;
                customChevron: string;
                hidesChevronWhenNull: string;
                omitsBodyWhenChildrenUndefined: string;
                forwardsClassNames: string;
            };
        };
        rtl: { title: string; body: string };
        apiReference: { title: string; intro: string };
    };
}

export const expandableSectionEn: ExpandableSectionTranslation = {
    default: {
        title: `Two stacked sections`,
        description: `Two sections with the shared visual treatment — one opening-hours card, one contact card. Each owns its own header layout; the chevron is the wrapper's job.`
    },
    stack: {
        title: `Panel-style stack`,
        description: `Three sections with leading icon + label + summary chip. The default-open events card sits on top; location and description start collapsed. Mirrors the pattern omniviv uses for the PlacesPanel sidebar.`
    },
    controlled: {
        title: `Controlled`,
        description: `External button toggles the same open state as the chevron. Useful when an upstream control (or hash-router, query-string, …) drives disclosure.`
    },
    disabled: {
        title: `Disabled (no body)`,
        description: `Pass disabled when the section has nothing to reveal. The chevron disappears, the trigger reports as disabled to assistive tech, and clicks have no effect.`
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
            body: `<ExpandableSection> is the styled Collapsible wrapper that omniviv uses for every disclosed card in PlacesPanel. The header row stays visible; the chevron auto-rotates with data-state. The wrapper doesn't care what's inside — compose it for any custom expandable content (opening hours, weather, events, code blocks, …).`
        },
        composition: {
            title: `Composition`,
            body: `Compose for any kind of disclosed content. Pass disabled when the section has nothing to reveal — the chevron disappears, the trigger reports as disabled to assistive tech, and clicks are inert. Use controlled mode (open + onOpenChange) when an upstream control drives the disclosure; uncontrolled mode (defaultOpen) is fine for everything else.`
        },
        examples: {
            title: `Examples`,
            default: {
                title: `Two stacked sections`,
                description: `Simple text body — opening hours + contact.`
            },
            stack: {
                title: `Panel-style stack`,
                description: `Three icon + label sections mirroring the PlacesPanel layout.`
            },
            controlled: {
                title: `Controlled`,
                description: `External button toggles the same open state.`
            },
            disabled: {
                title: `Disabled (no body)`,
                description: `Inert trigger, no chevron, no expansion.`
            }
        },
        definedBehaviour: {
            title: `Defined behaviour`,
            intro: `Statements describing how <ExpandableSection> is expected to behave, each linked to the test that verifies it.`,
            verifiedBy: `verified by`,
            statements: {
                collapsedByDefault: `Is collapsed by default — body is not rendered.`,
                opensOnClick: `Renders the body when opened via click.`,
                firesOnOpenChange: `Fires onOpenChange when the disclosure toggles.`,
                controllableOpen: `Is fully controllable via open + onOpenChange.`,
                defaultOpen: `defaultOpen renders the body on first paint.`,
                ariaLabelPerState: `Disclosure button advertises the right aria-label per state.`,
                disabledDoesNotExpand: `Disabled sections do not expand on click and have no chevron.`,
                disabledHasNoAriaLabel: `Disabled sections have no aria-label so screen readers don't promise a disclosure.`,
                customChevron: `Renders a custom chevron when provided.`,
                hidesChevronWhenNull: `Hides the chevron when chevron={null}.`,
                omitsBodyWhenChildrenUndefined: `Omits the body wrapper entirely when children is undefined.`,
                forwardsClassNames: `Forwards extra class names to the wrapper, trigger, and body.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Under dir="rtl" the header content flows to the trailing edge and the chevron lands on the leading edge — flex utilities handle the swap automatically.`
        },
        apiReference: {
            title: `API Reference`,
            intro: `Props accepted by <ExpandableSection>.`
        }
    }
};

export const expandableSectionDe: ExpandableSectionTranslation = {
    default: {
        title: `Zwei gestapelte Sektionen`,
        description: `Zwei Sektionen mit der gemeinsamen Optik — eine Öffnungszeiten-, eine Kontaktkarte. Jede besitzt ihr eigenes Header-Layout; das Chevron liefert der Wrapper.`
    },
    stack: {
        title: `Panel-artiger Stapel`,
        description: `Drei Sektionen mit führendem Icon + Label + Summary-Chip. Die default-offene Events-Karte oben; Location und Beschreibung starten eingeklappt. Spiegelt das Pattern, das omniviv im PlacesPanel verwendet.`
    },
    controlled: {
        title: `Kontrolliert`,
        description: `Ein externer Button schaltet denselben open-State wie das Chevron. Sinnvoll, wenn ein übergeordnetes Element (Hash-Router, Query-String, …) die Disclosure steuert.`
    },
    disabled: {
        title: `Deaktiviert (kein Body)`,
        description: `disabled übergeben, wenn die Sektion nichts aufzuklappen hat. Das Chevron verschwindet, der Trigger meldet sich für Screenreader als deaktiviert, und Klicks bleiben wirkungslos.`
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
            body: `<ExpandableSection> ist der gestylte Collapsible-Wrapper, den omniviv für jede ausklappbare Karte im PlacesPanel verwendet. Die Header-Reihe bleibt sichtbar; das Chevron dreht sich automatisch via data-state. Der Wrapper weiß nicht, was im Body steckt — komponiere ihn für beliebige ausklappbare Inhalte (Öffnungszeiten, Wetter, Events, Code-Blöcke, …).`
        },
        composition: {
            title: `Komposition`,
            body: `Für beliebige Disclosure-Inhalte komponieren. disabled übergeben, wenn die Sektion nichts aufzuklappen hat — Chevron verschwindet, Trigger meldet sich als deaktiviert, Klicks bleiben wirkungslos. Kontrollierter Modus (open + onOpenChange), wenn ein übergeordnetes Element die Disclosure steuert; unkontrolliert (defaultOpen) reicht für den Rest.`
        },
        examples: {
            title: `Beispiele`,
            default: {
                title: `Zwei gestapelte Sektionen`,
                description: `Einfacher Text-Body — Öffnungszeiten + Kontakt.`
            },
            stack: {
                title: `Panel-artiger Stapel`,
                description: `Drei Icon + Label-Sektionen wie im PlacesPanel.`
            },
            controlled: {
                title: `Kontrolliert`,
                description: `Externer Button schaltet denselben open-State.`
            },
            disabled: {
                title: `Deaktiviert (kein Body)`,
                description: `Inerter Trigger, kein Chevron, keine Aufklappung.`
            }
        },
        definedBehaviour: {
            title: `Festgelegtes Verhalten`,
            intro: `Aussagen darüber, wie sich <ExpandableSection> verhalten soll, jeweils mit Verweis auf den Test.`,
            verifiedBy: `geprüft durch`,
            statements: {
                collapsedByDefault: `Ist standardmäßig eingeklappt — Body nicht gerendert.`,
                opensOnClick: `Rendert den Body beim Klick auf den Trigger.`,
                firesOnOpenChange: `Feuert onOpenChange beim Toggle der Disclosure.`,
                controllableOpen: `Voll kontrollierbar via open + onOpenChange.`,
                defaultOpen: `defaultOpen rendert den Body sofort beim ersten Paint.`,
                ariaLabelPerState: `Disclosure-Button setzt das richtige aria-label pro Zustand.`,
                disabledDoesNotExpand: `Deaktivierte Sektionen klappen beim Klick nicht auf und haben kein Chevron.`,
                disabledHasNoAriaLabel: `Deaktivierte Sektionen tragen kein aria-label, damit Screenreader keine Disclosure versprechen.`,
                customChevron: `Rendert ein eigenes Chevron, wenn übergeben.`,
                hidesChevronWhenNull: `Blendet das Chevron aus, wenn chevron={null}.`,
                omitsBodyWhenChildrenUndefined: `Lässt den Body-Wrapper komplett weg, wenn children undefined ist.`,
                forwardsClassNames: `Reicht zusätzliche Class Names an Wrapper, Trigger und Body weiter.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Unter dir="rtl" wandert der Header-Inhalt an die nacheilende Kante und das Chevron an die führende — Flex-Utilities übernehmen den Swap automatisch.`
        },
        apiReference: {
            title: `API-Referenz`,
            intro: `Props, die <ExpandableSection> akzeptiert.`
        }
    }
};
