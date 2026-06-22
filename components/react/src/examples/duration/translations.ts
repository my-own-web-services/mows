export interface DurationTranslation {
    default: { title: string; description: string };
    responsive: { title: string; description: string };
    variants: { title: string; description: string };
    granularity: { title: string; description: string };
    ranges: { title: string; description: string };
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
            responsive: { title: string; description: string };
            variants: { title: string; description: string };
            granularity: { title: string; description: string };
            ranges: { title: string; description: string };
        };
        rtl: { title: string; body: string };
        definedBehaviour: {
            title: string;
            intro: string;
            verifiedBy: string;
            statements: {
                splitsToTwoParts: string;
                dropsZeroSecondary: string;
                neverZeroSeconds: string;
                minUnitFloors: string;
                minUnitLessThan: string;
                subMinuteSecondsOnly: string;
                longVariant: string;
                mediumVariant: string;
                shortVariant: string;
                forceVariant: string;
                ariaLabelVerbose: string;
                clampsNegatives: string;
            };
        };
        apiReference: { title: string; intro: string };
    };
}

export const durationEn: DurationTranslation = {
    default: {
        title: `Default`,
        description: `A 1 h 10 min duration shown inside a fixed-width chip. The container's width drives the picked variant.`
    },
    responsive: {
        title: `Responsive variants`,
        description: `Same input rendered in three columns of decreasing width. The component picks the longest label that still fits: 1 h 10 min → 1 h 10 m → 1 h 10.`
    },
    variants: {
        title: `Forced variants`,
        description: `Pass the variant prop explicitly to bypass the ResizeObserver and lock in a specific verbosity — useful in fixed chips or table cells.`
    },
    granularity: {
        title: `Granularity (minUnit)`,
        description: `Coarsen the displayed precision by passing the smallest unit you want to surface (s, min, h, d). Sub-precision values collapse to "<1 [unit]" — the component never shows "0 s".`
    },
    ranges: {
        title: `Magnitudes`,
        description: `Sub-minute, minutes, hours, multi-day. The largest non-zero unit always anchors the output and the next sub-unit fills the second slot.`
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
            body: `<Duration> takes a duration in seconds and renders it like 1 h 10 min. With no variant override the component measures its wrapper via ResizeObserver and picks the most verbose label that still fits — degrading to 1 h 10 m, then 1 h 10, as the column shrinks. Pass variant to opt out of measurement entirely.`
        },
        composition: {
            title: `Composition`,
            body: `<Duration> is display: inline-block and clips overflow, so let the parent decide how wide it should be. Inside a flex row that's a fractional flex-basis; inside a grid cell it's the cell width; inside a fixed chip it's the chip width. The same input renders verbose in a 200 px slot and collapses to 1 h 10 in a 60 px slot — no media queries required.`
        },
        examples: {
            title: `Examples`,
            default: {
                title: `Default`,
                description: `Inside a fixed-width chip. The container width drives the picked variant.`
            },
            responsive: {
                title: `Responsive variants`,
                description: `Three columns, three widths, three picked variants for the same input.`
            },
            variants: {
                title: `Forced variants`,
                description: `Bypass measurement with an explicit variant prop.`
            },
            granularity: {
                title: `Granularity (minUnit)`,
                description: `Coarsen the precision with minUnit — sub-precision inputs render as "<1 [unit]".`
            },
            ranges: {
                title: `Magnitudes`,
                description: `Sub-minute through multi-day on a single component.`
            }
        },
        definedBehaviour: {
            title: `Defined behaviour`,
            intro: `Statements describing how <Duration> is expected to behave, each linked to the test that verifies it.`,
            verifiedBy: `verified by`,
            statements: {
                splitsToTwoParts: `Splits a duration into the largest non-zero unit and the next sub-unit when the sub-unit is non-zero (1 h 10 min, 5 min 30 s, 2 d 4 h).`,
                dropsZeroSecondary: `Omits the secondary unit when it would be zero, so an exact hour renders as 1 h instead of 1 h 0 min.`,
                neverZeroSeconds: `Never renders "0 s" (or any "0 [unit]") — an exactly zero input collapses to "<1 s" so the label always conveys a real magnitude.`,
                minUnitFloors: `minUnit floors the duration to the requested precision: minUnit="min" turns 5 min 30 s into 5 min, minUnit="h" turns 1 h 10 min into 1 h.`,
                minUnitLessThan: `Input below the requested precision renders as "<1 [minUnit]", so 30 s at minUnit="min" becomes "<1 min" — never "0 min".`,
                subMinuteSecondsOnly: `Renders sub-minute durations as a single seconds part.`,
                longVariant: `In the long variant, renders 1 h 10 min verbatim.`,
                mediumVariant: `In the medium variant, collapses min → m to render 1 h 10 m.`,
                shortVariant: `In the short variant, drops the trailing unit label to render 1 h 10.`,
                forceVariant: `Locks the visible variant to the requested one when the variant prop is set.`,
                ariaLabelVerbose: `Exposes the verbose (long-variant) string as aria-label even when the visible label is collapsed.`,
                clampsNegatives: `Clamps negative or non-finite inputs to 0 s instead of throwing.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Numeric labels read left-to-right (the SI convention) even inside dir="rtl" — the inline-block wrapper preserves the numeric direction while flowing with the surrounding text.`
        },
        apiReference: {
            title: `API Reference`,
            intro: `Props accepted by <Duration>.`
        }
    }
};

export const durationDe: DurationTranslation = {
    default: {
        title: `Standard`,
        description: `Eine Dauer von 1 h 10 min in einem Chip fester Breite. Die Containerbreite entscheidet, welche Variante gewählt wird.`
    },
    responsive: {
        title: `Responsive Varianten`,
        description: `Derselbe Wert in drei unterschiedlich breiten Spalten. Die Komponente wählt jeweils die ausführlichste Beschriftung, die noch passt: 1 h 10 min → 1 h 10 m → 1 h 10.`
    },
    variants: {
        title: `Erzwungene Varianten`,
        description: `Mit gesetztem variant-Prop wird der ResizeObserver übersprungen und eine feste Verbosität verwendet — sinnvoll in Chips oder Tabellenzellen.`
    },
    granularity: {
        title: `Genauigkeit (minUnit)`,
        description: `Über minUnit (s, min, h, d) wird die kleinste angezeigte Einheit festgelegt. Werte unterhalb der Auflösung werden zu "<1 [unit]" — "0 s" erscheint nie.`
    },
    ranges: {
        title: `Größenordnungen`,
        description: `Sekunden, Minuten, Stunden, mehrere Tage. Die größte nicht-null Einheit verankert die Ausgabe, die nächstkleinere Einheit füllt die zweite Position.`
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
            body: `<Duration> nimmt eine Dauer in Sekunden und stellt sie als 1 h 10 min dar. Ohne variant-Override misst die Komponente ihren Wrapper per ResizeObserver und wählt die ausführlichste Beschriftung, die noch passt — verkürzt zu 1 h 10 m oder 1 h 10, sobald die Spalte schrumpft. Setze variant, um die Messung komplett zu umgehen.`
        },
        composition: {
            title: `Komposition`,
            body: `<Duration> ist display: inline-block und schneidet Überlauf ab — der Elter entscheidet über die Breite. In einer flex-Row ist das ein fractional flex-basis, in einem Grid-Feld die Zellbreite, in einem Chip die Chip-Breite. Derselbe Wert rendert in 200 px als 1 h 10 min und in 60 px als 1 h 10 — ohne Media Queries.`
        },
        examples: {
            title: `Beispiele`,
            default: {
                title: `Standard`,
                description: `In einem Chip fester Breite. Die Containerbreite bestimmt die Variante.`
            },
            responsive: {
                title: `Responsive Varianten`,
                description: `Drei Spalten, drei Breiten, drei gewählte Varianten für denselben Eingabewert.`
            },
            variants: {
                title: `Erzwungene Varianten`,
                description: `Messung umgehen durch explizites variant-Prop.`
            },
            granularity: {
                title: `Genauigkeit (minUnit)`,
                description: `Genauigkeit per minUnit gröber stellen — sub-precision-Werte rendern als "<1 [unit]".`
            },
            ranges: {
                title: `Größenordnungen`,
                description: `Sekunden bis mehrere Tage mit einer Komponente.`
            }
        },
        definedBehaviour: {
            title: `Festgelegtes Verhalten`,
            intro: `Aussagen darüber, wie sich <Duration> verhalten soll, jeweils mit Verweis auf den Test.`,
            verifiedBy: `geprüft durch`,
            statements: {
                splitsToTwoParts: `Teilt eine Dauer in die größte nicht-null Einheit und die nächstkleinere Einheit auf, wenn diese nicht null ist (1 h 10 min, 5 min 30 s, 2 d 4 h).`,
                dropsZeroSecondary: `Lässt die zweite Einheit weg, wenn sie null wäre — eine exakte Stunde rendert als 1 h statt 1 h 0 min.`,
                neverZeroSeconds: `Rendert nie "0 s" (und kein anderes "0 [unit]") — eine Dauer von exakt null wird zu "<1 s", die Beschriftung trägt immer eine echte Größe.`,
                minUnitFloors: `minUnit setzt die Genauigkeit: minUnit="min" macht aus 5 min 30 s ein 5 min, minUnit="h" aus 1 h 10 min ein 1 h.`,
                minUnitLessThan: `Eingaben unterhalb der eingestellten Genauigkeit rendern als "<1 [minUnit]", 30 s bei minUnit="min" wird also zu "<1 min" — nie "0 min".`,
                subMinuteSecondsOnly: `Stellt Dauern unter einer Minute als einzelnen Sekundenteil dar.`,
                longVariant: `In der long-Variante wird 1 h 10 min wörtlich gerendert.`,
                mediumVariant: `In der medium-Variante wird min → m gekürzt und 1 h 10 m ausgegeben.`,
                shortVariant: `In der short-Variante wird die letzte Einheitsbeschriftung weggelassen und 1 h 10 ausgegeben.`,
                forceVariant: `Erzwingt die sichtbare Variante, wenn das variant-Prop gesetzt ist.`,
                ariaLabelVerbose: `Stellt den ausführlichen (long) Text als aria-label bereit, auch wenn die sichtbare Beschriftung gekürzt ist.`,
                clampsNegatives: `Klemmt negative oder nicht-finite Eingaben auf 0 s, ohne zu werfen.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Numerische Beschriftungen werden links-nach-rechts gelesen (SI-Konvention), auch unter dir="rtl" — der inline-block-Wrapper bewahrt die numerische Richtung und fließt im umgebenden Text mit.`
        },
        apiReference: {
            title: `API-Referenz`,
            intro: `Props, die <Duration> akzeptiert.`
        }
    }
};
