export interface CoordinateLinksTranslation {
    default: { title: string; description: string };
    withLabel: { title: string; description: string; label: string };
    custom: { title: string; description: string };
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
            withLabel: { title: string; description: string };
            custom: { title: string; description: string };
        };
        definedBehaviour: {
            title: string;
            intro: string;
            verifiedBy: string;
            statements: {
                rendersDefaultProviders: string;
                geoUsesCoordinate: string;
                opensInNewTab: string;
                respectsCustomOrder: string;
                acceptsCustomProvider: string;
                validatesCoordinate: string;
            };
        };
        rtl: { title: string; body: string };
        apiReference: { title: string; intro: string };
    };
}

export const coordinateLinksEn: CoordinateLinksTranslation = {
    default: {
        title: `Default`,
        description: `Plain underlined links — geo: URI first (its text is the coordinate itself), then OpenStreetMap, Google, Bing, Apple Maps.`
    },
    withLabel: {
        title: `With heading label`,
        description: `Optional label prop renders a heading above the link list. Otherwise identical to the default.`,
        label: `Open in`
    },
    custom: {
        title: `Custom provider`,
        description: `Pass an explicit providers list to reorder, subset, or mix in your own MapProvider record.`
    },
    doc: {
        installation: {
            title: `Installation`,
            commandTab: `Command`,
            manualTab: `Manual`,
            manualStep1: `Install the package:`,
            manualStep2: `Copy and paste the following code into your project.`,
            manualStep3: `Update the import paths to match your project setup.`
        },
        usage: {
            title: `Usage`,
            body: `<CoordinateLinks> renders one underlined link per registered map provider for a given latitude/longitude. It does not embed a map surface — pair with <LocationPicker> when the user needs to pick the coordinate first.`
        },
        composition: {
            title: `Composition`,
            body: `Providers are either built-in ids (geo, openstreetmap, google, bing, apple) or full MapProvider records — useful for tenant-specific deep-links. The geo: entry is an RFC 5870 URI whose link text is the coordinate itself; whichever map app is registered for the geo: scheme on the user's device handles the click. Unknown ids throw at resolve time rather than rendering an empty list.`
        },
        examples: {
            title: `Examples`,
            default: {
                title: `Default`,
                description: `Bare component — five built-in providers stacked.`
            },
            withLabel: {
                title: `With heading label`,
                description: `Same defaults, with an optional "Open in" heading above the links.`
            },
            custom: {
                title: `Custom provider`,
                description: `Mix a custom MapProvider into the resolved list.`
            }
        },
        definedBehaviour: {
            title: `Defined behaviour`,
            intro: `Statements describing how <CoordinateLinks> is expected to behave, each linked to the test that verifies it.`,
            verifiedBy: `verified by`,
            statements: {
                rendersDefaultProviders: `Renders one link per provider in the default order when no providers prop is supplied.`,
                geoUsesCoordinate: `The geo: link's text is the coordinate itself, formatted to the requested precision.`,
                opensInNewTab: `Every link opens in a new tab with target=_blank and rel=noopener noreferrer.`,
                respectsCustomOrder: `Renders provider links in the exact order supplied via the providers prop.`,
                acceptsCustomProvider: `Accepts a full MapProvider record alongside built-in ids and uses its buildUrl verbatim.`,
                validatesCoordinate: `Throws synchronously on a non-finite or out-of-range latitude or longitude.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Provider labels are direction-agnostic; the vertical list mirrors automatically under dir="rtl".`
        },
        apiReference: {
            title: `API Reference`,
            intro: `Props accepted by <CoordinateLinks>.`
        }
    }
};

export const coordinateLinksDe: CoordinateLinksTranslation = {
    default: {
        title: `Standard`,
        description: `Schlichte unterstrichene Links — geo:-URI zuerst (sein Text ist die Koordinate selbst), danach OpenStreetMap, Google, Bing, Apple Maps.`
    },
    withLabel: {
        title: `Mit Überschrift`,
        description: `Die optionale label-Prop rendert eine Überschrift über der Linkliste. Ansonsten identisch zum Standard.`,
        label: `Öffnen in`
    },
    custom: {
        title: `Eigener Provider`,
        description: `Übergib eine explizite providers-Liste, um die Reihenfolge zu ändern, zu beschränken oder einen eigenen MapProvider hinzuzumischen.`
    },
    doc: {
        installation: {
            title: `Installation`,
            commandTab: `Befehl`,
            manualTab: `Manuell`,
            manualStep1: `Paket installieren:`,
            manualStep2: `Kopiere den folgenden Code in dein Projekt.`,
            manualStep3: `Passe die Importpfade an dein Projekt an.`
        },
        usage: {
            title: `Verwendung`,
            body: `<CoordinateLinks> rendert einen unterstrichenen Link pro registriertem Map-Anbieter für eine gegebene Latitude/Longitude. Es bettet keine Karte ein — kombiniere mit <LocationPicker>, wenn der Nutzer die Koordinate erst auswählen soll.`
        },
        composition: {
            title: `Komposition`,
            body: `Provider sind entweder eingebaute IDs (geo, openstreetmap, google, bing, apple) oder vollständige MapProvider-Datensätze — nützlich für mandantenspezifische Deep-Links. Der geo:-Eintrag ist ein RFC-5870-URI, dessen Linktext die Koordinate selbst ist; den Klick übernimmt die Karten-App, die auf dem Gerät für das geo:-Schema registriert ist. Unbekannte IDs werfen beim Auflösen, statt eine leere Liste zu rendern.`
        },
        examples: {
            title: `Beispiele`,
            default: {
                title: `Standard`,
                description: `Komponente pur — fünf eingebaute Anbieter untereinander.`
            },
            withLabel: {
                title: `Mit Überschrift`,
                description: `Gleiche Defaults, mit optionaler "Öffnen in"-Überschrift über den Links.`
            },
            custom: {
                title: `Eigener Provider`,
                description: `Einen eigenen MapProvider in die aufgelöste Liste einmischen.`
            }
        },
        definedBehaviour: {
            title: `Festgelegtes Verhalten`,
            intro: `Aussagen darüber, wie sich <CoordinateLinks> verhalten soll, jeweils mit Verweis auf den Test.`,
            verifiedBy: `geprüft durch`,
            statements: {
                rendersDefaultProviders: `Rendert pro Anbieter in der Standardreihenfolge einen Link, wenn keine providers-Prop angegeben ist.`,
                geoUsesCoordinate: `Der Linktext des geo:-Eintrags ist die Koordinate selbst, formatiert mit der gewünschten Präzision.`,
                opensInNewTab: `Jeder Link öffnet in neuem Tab mit target=_blank und rel=noopener noreferrer.`,
                respectsCustomOrder: `Rendert die Anbieter genau in der per providers-Prop übergebenen Reihenfolge.`,
                acceptsCustomProvider: `Akzeptiert einen vollständigen MapProvider-Datensatz neben eingebauten IDs und verwendet dessen buildUrl unverändert.`,
                validatesCoordinate: `Wirft synchron bei nicht endlicher oder außerhalb des Bereichs liegender Latitude oder Longitude.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Anbieter-Labels sind richtungsneutral; die vertikale Liste spiegelt unter dir="rtl" automatisch.`
        },
        apiReference: {
            title: `API-Referenz`,
            intro: `Props, die <CoordinateLinks> akzeptiert.`
        }
    }
};
