export interface IconBadgeTranslation {
    default: { title: string; description: string };
    positions: { title: string; description: string };
    patterns: { title: string; description: string };
    filled: { title: string; description: string };
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
            positions: { title: string; description: string };
            patterns: { title: string; description: string };
            filled: { title: string; description: string };
        };
        definedBehaviour: {
            title: string;
            intro: string;
            verifiedBy: string;
            statements: {
                rendersBothIcons: string;
                punchesMaskHole: string;
                noDefaultOutline: string;
                badgeSizeFromFraction: string;
                cornerAnchoring: string;
                edgeAnchoring: string;
                badgeClassNameOverrides: string;
                badgeGapShiftsRadius: string;
            };
        };
        rtl: { title: string; body: string };
        apiReference: { title: string; intro: string };
    };
}

export const iconBadgeEn: IconBadgeTranslation = {
    default: {
        title: `Default`,
        description: `A file icon with a cloud sub-icon in the bottom-right corner. The cloud's circular footprint is cut out of the file underneath so the page background shows through the hole.`
    },
    positions: {
        title: `All eight positions`,
        description: `Four corners plus four edge midpoints. The mask follows the badge so the cutout always lines up.`
    },
    patterns: {
        title: `Transparent cutout`,
        description: `Whatever pixels sit behind the badge area show through verbatim — checkerboard, multi-stop gradient, or a dotted field.`
    },
    filled: {
        title: `Filled badge`,
        description: `Pass a bg-* class via badgeClassName to opt into a coloured status disc. The mask still cuts the primary icon out behind the fill.`
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
            body: `<IconBadge> takes a primary icon and a sub-icon and overlays the sub-icon at one of eight anchor positions. The badge area is punched out of the primary icon via CSS mask-image, so the cutout is genuinely transparent — no per-surface fill prop required.`
        },
        composition: {
            title: `Composition`,
            body: `Size the icons themselves via the props you pass in (e.g. <File className="h-12 w-12" />). The component lays them out in a size × size box and computes the badge diameter from badgeFraction. By default the badge wrapper has no border or fill — the visible "circle" is purely the masked hole. Use badgeClassName to opt into a coloured fill.`
        },
        examples: {
            title: `Examples`,
            default: {
                title: `Default`,
                description: `File + cloud sub-icon in the bottom-right corner.`
            },
            positions: {
                title: `All eight positions`,
                description: `Four corners + four edge midpoints.`
            },
            patterns: {
                title: `Transparent cutout`,
                description: `Sits on a checkerboard, a gradient and a dot field — the cutout shows through every backdrop verbatim.`
            },
            filled: {
                title: `Filled badge`,
                description: `Opt-in coloured fill via badgeClassName for status indicators.`
            }
        },
        definedBehaviour: {
            title: `Defined behaviour`,
            intro: `Statements describing how <IconBadge> is expected to behave, each linked to the test that verifies it.`,
            verifiedBy: `verified by`,
            statements: {
                rendersBothIcons: `Renders both the primary icon and the badge sub-icon.`,
                punchesMaskHole: `Applies a radial-gradient CSS mask to the primary icon so the badge area becomes truly transparent and the parent surface shows through.`,
                noDefaultOutline: `Renders without a border or background fill on the badge wrapper — the masked hole alone defines the visible badge.`,
                badgeSizeFromFraction: `Computes the badge diameter from size × badgeFraction.`,
                cornerAnchoring: `Anchors the badge to bottom-right by default and switches anchor + mask centre on every corner.`,
                edgeAnchoring: `Supports the four edge midpoints (top, right, bottom, left) with the matching side flush and the orthogonal axis centred.`,
                badgeClassNameOverrides: `Forwards badgeClassName to the badge container so consumers can opt into a coloured fill.`,
                badgeGapShiftsRadius: `Grows the punched-hole radius by badgeGap so the mask sits clearly outside the badge wrapper.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Anchoring uses physical sides (right / left), so the badge stays on the same visual side under dir="rtl". Pick a different badgePosition if the convention should follow the writing direction.`
        },
        apiReference: {
            title: `API Reference`,
            intro: `Props accepted by <IconBadge>.`
        }
    }
};

export const iconBadgeDe: IconBadgeTranslation = {
    default: {
        title: `Standard`,
        description: `Ein Datei-Icon mit Cloud-Sub-Icon unten rechts. Der Kreis des Cloud-Icons wird aus dem darunterliegenden Datei-Icon ausgeschnitten, sodass der Seitenhintergrund durchscheint.`
    },
    positions: {
        title: `Alle acht Positionen`,
        description: `Vier Ecken plus vier Kanten-Mittelpunkte. Die Maske folgt dem Badge, der Ausschnitt sitzt immer passgenau.`
    },
    patterns: {
        title: `Transparenter Ausschnitt`,
        description: `Was hinter dem Badge-Bereich liegt, scheint unverändert durch — Schachbrett, mehrstufiger Verlauf oder Punktraster.`
    },
    filled: {
        title: `Gefüllter Badge`,
        description: `Per bg-* Klasse über badgeClassName eine farbige Status-Scheibe einblenden. Die Maske schneidet das Hauptsymbol hinter der Füllung weiterhin aus.`
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
            body: `<IconBadge> nimmt ein Hauptsymbol und ein Sub-Icon und überlagert das Sub-Icon an einer von acht Ankerpositionen. Der Badge-Bereich wird per CSS mask-image aus dem Hauptsymbol ausgestanzt, sodass der Ausschnitt tatsächlich transparent ist — keine flächenspezifische Fill-Prop nötig.`
        },
        composition: {
            title: `Komposition`,
            body: `Die Icon-Größen kommen aus den Props, die du übergibst (z. B. <File className="h-12 w-12" />). Die Komponente legt sie in einer size × size-Box an und berechnet den Badge-Durchmesser aus badgeFraction. Per Default hat der Badge-Container weder Rahmen noch Füllung — der sichtbare "Kreis" entsteht ausschließlich durch die Maske. Mit badgeClassName lässt sich eine farbige Füllung aktivieren.`
        },
        examples: {
            title: `Beispiele`,
            default: {
                title: `Standard`,
                description: `Datei + Cloud-Sub-Icon unten rechts.`
            },
            positions: {
                title: `Alle acht Positionen`,
                description: `Vier Ecken + vier Kanten-Mittelpunkte.`
            },
            patterns: {
                title: `Transparenter Ausschnitt`,
                description: `Auf Schachbrett, Verlauf und Punktraster — der Ausschnitt zeigt jeden Hintergrund unverändert.`
            },
            filled: {
                title: `Gefüllter Badge`,
                description: `Optionale farbige Füllung über badgeClassName für Statusindikatoren.`
            }
        },
        definedBehaviour: {
            title: `Festgelegtes Verhalten`,
            intro: `Aussagen darüber, wie sich <IconBadge> verhalten soll, jeweils mit Verweis auf den Test.`,
            verifiedBy: `geprüft durch`,
            statements: {
                rendersBothIcons: `Rendert sowohl das Hauptsymbol als auch das Badge-Sub-Icon.`,
                punchesMaskHole: `Setzt eine Radial-Gradient-CSS-Maske auf das Hauptsymbol, sodass der Badge-Bereich tatsächlich transparent wird und die darunterliegende Fläche durchscheint.`,
                noDefaultOutline: `Rendert ohne Rahmen oder Füllung auf dem Badge-Container — das ausgestanzte Loch allein definiert das sichtbare Badge.`,
                badgeSizeFromFraction: `Berechnet den Badge-Durchmesser aus size × badgeFraction.`,
                cornerAnchoring: `Verankert den Badge standardmäßig unten rechts und tauscht Anker plus Maskenzentrum für jede Ecke.`,
                edgeAnchoring: `Unterstützt die vier Kanten-Mittelpunkte (oben, rechts, unten, links) mit bündiger Seite und zentrierter Orthogonal-Achse.`,
                badgeClassNameOverrides: `Reicht badgeClassName an den Badge-Container weiter, damit Konsumenten eine farbige Füllung aktivieren können.`,
                badgeGapShiftsRadius: `Vergrößert den Ausschnittsradius um badgeGap, sodass die Maske deutlich außerhalb des Badge-Containers sitzt.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Die Verankerung nutzt physische Seiten (right / left), der Badge bleibt unter dir="rtl" also auf derselben visuellen Seite. Für richtungsabhängige Verankerung badgePosition explizit setzen.`
        },
        apiReference: {
            title: `API-Referenz`,
            intro: `Props, die <IconBadge> akzeptiert.`
        }
    }
};
