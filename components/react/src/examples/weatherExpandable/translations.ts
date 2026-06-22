export interface WeatherExpandableTranslation {
    default: { title: string; description: string };
    collapsed: { title: string; description: string };
    headerOnly: { title: string; description: string };
    icons: { title: string; description: string };
    localised: { title: string; description: string };
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
            collapsed: { title: string; description: string };
            headerOnly: { title: string; description: string };
            icons: { title: string; description: string };
            localised: { title: string; description: string };
        };
        definedBehaviour: {
            title: string;
            intro: string;
            verifiedBy: string;
            statements: {
                placeholderNoData: string;
                temperatureRounded: string;
                emojiForIcon: string;
                emojiFallback: string;
                conditionGerman: string;
                conditionOverride: string;
                precip60Preferred: string;
                precipFallback: string;
                precipOmittedWhenZero: string;
                wind60Preferred: string;
                collapsedByDefault: string;
                extrasOnExpand: string;
                noExtrasRow: string;
                forecastColumns: string;
                rainChipPositive: string;
                attributionWithForecast: string;
                attributionWithoutForecast: string;
                firesOnOpenChange: string;
                controllableOpen: string;
                defaultOpen: string;
                disclosureAriaLabel: string;
                disabledWhenEmpty: string;
                chevronHiddenWhenDisabled: string;
                enabledWithAttributionOnly: string;
                extrasTooltipsTranslated: string;
                regionAriaLabel: string;
                emojiVocabulary: string;
                lucideIconMode: string;
                emojiDefault: string;
                fahrenheitConversion: string;
                kelvinConversion: string;
                forecastUnitConversion: string;
            };
        };
        rtl: { title: string; body: string };
        apiReference: { title: string; intro: string };
    };
}

export const weatherExpandableEn: WeatherExpandableTranslation = {
    default: {
        title: `Open with forecast`,
        description: `Header row (emoji + temperature + condition + precipitation + wind) plus the expanded body with extras row (cloud cover, humidity, visibility, pressure) and a six-day forecast strip. All values are fabricated demo data.`
    },
    collapsed: {
        title: `Collapsed by default`,
        description: `The card stays compact until the user clicks the header. The active 60-minute precipitation aggregate ("0.8mm") and wind chip ("18km/h") remain visible while collapsed.`
    },
    headerOnly: {
        title: `Header only`,
        description: `No forecast and no extras — when there's nothing to reveal, opening the body shows an empty placeholder. Useful when only "right now" data is available.`
    },
    icons: {
        title: `Lucide icons`,
        description: `\`glyphStyle="icon"\` swaps the colour emoji for monochrome \`lucide-react\` icons that inherit the surrounding text colour. Useful when the host design system enforces a single stroke style.`
    },
    localised: {
        title: `Localised (en-US, Fahrenheit)`,
        description: `Every translatable string overridden via the strings prop. The locale prop drives the forecast weekday formatter so "Fr" becomes "Fri", and \`temperatureUnit="fahrenheit"\` converts the °C-shaped data into Fahrenheit at render time.`
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
            body: `<WeatherExpandable> is a collapsible weather card ported 1:1 from the omniviv PlacesPanel weather section. The header row shows emoji + thermometer + temperature + condition + precipitation + wind chips and stays visible at all times. The disclosure chevron toggles the body, which contains an extras row (cloud cover, humidity, visibility, pressure) and a horizontally-scrollable multi-day forecast strip with attribution.`
        },
        composition: {
            title: `Composition`,
            body: `Purely presentational: the consumer owns the fetch (no internal effects, no API calls). Built on the Radix Collapsible primitive — controlled via open + onOpenChange, or uncontrolled via defaultOpen. Override every translatable string via the strings prop; the German defaults mirror the omniviv reference (Trocken / Regen / Bewölkung / Sichtweite / …).`
        },
        examples: {
            title: `Examples`,
            default: {
                title: `Open with forecast`,
                description: `Default cascade. Header + extras + six-day forecast strip.`
            },
            collapsed: {
                title: `Collapsed by default`,
                description: `Card stays compact until the user clicks.`
            },
            headerOnly: {
                title: `Header only`,
                description: `No forecast, no extras — minimal data shape.`
            },
            icons: {
                title: `Lucide icons`,
                description: `Monochrome \`lucide-react\` icons in place of the colour emoji.`
            },
            localised: {
                title: `Localised (en-US, Fahrenheit)`,
                description: `English string overrides + en-US weekday format + Fahrenheit display.`
            }
        },
        definedBehaviour: {
            title: `Defined behaviour`,
            intro: `Statements describing how <WeatherExpandable> is expected to behave, each linked to the test that verifies it.`,
            verifiedBy: `verified by`,
            statements: {
                placeholderNoData: `Renders the header with placeholder when no data is provided.`,
                temperatureRounded: `Renders the temperature rounded to an integer with the °C unit.`,
                emojiForIcon: `Renders the matching emoji for the icon key.`,
                emojiFallback: `Falls back to the thermometer emoji for unknown icon keys.`,
                conditionGerman: `Translates the condition key into German by default.`,
                conditionOverride: `Overrides condition labels via the strings prop.`,
                precip60Preferred: `Prefers precipitation_60 over precipitation for the header chip.`,
                precipFallback: `Falls back to precipitation when precipitation_60 is missing.`,
                precipOmittedWhenZero: `Omits the precipitation chip when value is zero.`,
                wind60Preferred: `Prefers wind_speed_60 over wind_speed for the header chip.`,
                collapsedByDefault: `Is collapsed by default (extras + forecast are not in the DOM).`,
                extrasOnExpand: `Expands on click and renders the extras row when extras are set.`,
                noExtrasRow: `Omits the extras row when no extras are set.`,
                forecastColumns: `Renders one forecast column per day with weekday + emoji + min/max.`,
                rainChipPositive: `Renders the rain-probability chip only when probability is positive.`,
                attributionWithForecast: `Renders the attribution inside the forecast section when both are present.`,
                attributionWithoutForecast: `Still renders the attribution when no forecast is provided (extras row only).`,
                firesOnOpenChange: `Fires onOpenChange when the disclosure toggles.`,
                controllableOpen: `Is fully controllable via open + onOpenChange.`,
                defaultOpen: `defaultOpen renders the body on first paint.`,
                disclosureAriaLabel: `Disclosure button advertises the right aria-label per state.`,
                disabledWhenEmpty: `Disables the disclosure when there is no body content (no extras / no forecast / no attribution).`,
                chevronHiddenWhenDisabled: `Hides the chevron when the disclosure is disabled (header-only mode).`,
                enabledWithAttributionOnly: `Enables the disclosure when only attribution is set (still something to reveal).`,
                extrasTooltipsTranslated: `Extras chips carry the translated tooltip labels.`,
                regionAriaLabel: `Region carries the translated aria-label.`,
                emojiVocabulary: `resolveWeatherEmoji exposes the full vocabulary mapping (port parity).`,
                lucideIconMode: `Renders a monochrome lucide icon when glyphStyle="icon".`,
                emojiDefault: `Keeps emoji rendering when glyphStyle is omitted.`,
                fahrenheitConversion: `Converts to Fahrenheit when temperatureUnit="fahrenheit".`,
                kelvinConversion: `Converts to Kelvin when temperatureUnit="kelvin".`,
                forecastUnitConversion: `Forecast min/max follow the selected temperatureUnit.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Under dir="rtl" the header layout mirrors via flex utilities — emoji + temperature flow to the leading edge, precipitation + wind chips and chevron to the trailing edge. The forecast strip stays a horizontal scroll either way.`
        },
        apiReference: {
            title: `API Reference`,
            intro: `Props accepted by <WeatherExpandable>.`
        }
    }
};

export const weatherExpandableDe: WeatherExpandableTranslation = {
    default: {
        title: `Mit Vorhersage geöffnet`,
        description: `Header-Reihe (Emoji + Temperatur + Wetterlage + Niederschlag + Wind) plus aufgeklappter Body mit Extras-Reihe (Bewölkung, Luftfeuchte, Sicht, Luftdruck) und Sechs-Tage-Vorhersage. Alle Werte sind erfundene Demo-Daten.`
    },
    collapsed: {
        title: `Standardmäßig eingeklappt`,
        description: `Die Karte bleibt kompakt, bis der Nutzer den Header klickt. Das aktive 60-Minuten-Niederschlag-Mittel („0.8mm") und der Wind-Chip („18km/h") bleiben im eingeklappten Zustand sichtbar.`
    },
    headerOnly: {
        title: `Nur Header`,
        description: `Keine Vorhersage, keine Extras — wenn nichts aufzuklappen ist, zeigt der Body beim Öffnen einen leeren Platzhalter. Sinnvoll, wenn nur „jetzt"-Daten vorhanden sind.`
    },
    icons: {
        title: `Lucide-Icons`,
        description: `\`glyphStyle="icon"\` ersetzt die Farb-Emojis durch monochrome \`lucide-react\`-Icons, die die umgebende Textfarbe übernehmen. Sinnvoll, wenn das Design-System nur eine einzige Stricharten-Linie zulässt.`
    },
    localised: {
        title: `Lokalisiert (en-US, Fahrenheit)`,
        description: `Alle übersetzbaren Strings via strings-Prop ersetzt. Die locale-Prop steuert den Vorhersage-Wochentag-Formatter, sodass „Fr" zu „Fri" wird, und \`temperatureUnit="fahrenheit"\` wandelt die °C-Daten beim Rendern in Fahrenheit um.`
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
            body: `<WeatherExpandable> ist eine aufklappbare Wetterkarte, 1:1 aus der omniviv-PlacesPanel-Wetter-Sektion portiert. Die Header-Reihe zeigt Emoji + Thermometer + Temperatur + Wetterlage + Niederschlag- und Wind-Chips und bleibt jederzeit sichtbar. Das Disclosure-Chevron klappt den Body auf, der eine Extras-Reihe (Bewölkung, Luftfeuchte, Sichtweite, Luftdruck) und einen horizontal scrollbaren Mehr-Tages-Vorhersage-Strip mit Attribution enthält.`
        },
        composition: {
            title: `Komposition`,
            body: `Rein präsentational: der Konsument besitzt den Fetch (keine internen Effects, keine API-Calls). Aufbauend auf dem Radix-Collapsible-Primitive — kontrolliert via open + onOpenChange, ansonsten unkontrolliert via defaultOpen. Jeden übersetzbaren String via strings-Prop ersetzbar; die deutschen Defaults spiegeln die omniviv-Referenz (Trocken / Regen / Bewölkung / Sichtweite / …).`
        },
        examples: {
            title: `Beispiele`,
            default: {
                title: `Mit Vorhersage geöffnet`,
                description: `Standard. Header + Extras + Sechs-Tage-Vorhersage.`
            },
            collapsed: {
                title: `Standardmäßig eingeklappt`,
                description: `Karte bleibt kompakt, bis der Nutzer klickt.`
            },
            headerOnly: {
                title: `Nur Header`,
                description: `Keine Vorhersage, keine Extras — minimaler Datensatz.`
            },
            icons: {
                title: `Lucide-Icons`,
                description: `Monochrome \`lucide-react\`-Icons anstelle der Farb-Emojis.`
            },
            localised: {
                title: `Lokalisiert (en-US, Fahrenheit)`,
                description: `Englische String-Overrides + en-US Wochentag-Format + Fahrenheit-Anzeige.`
            }
        },
        definedBehaviour: {
            title: `Festgelegtes Verhalten`,
            intro: `Aussagen darüber, wie sich <WeatherExpandable> verhalten soll, jeweils mit Verweis auf den Test.`,
            verifiedBy: `geprüft durch`,
            statements: {
                placeholderNoData: `Rendert den Header mit Placeholder ohne data-Prop.`,
                temperatureRounded: `Rendert die Temperatur auf Ganzzahl gerundet mit °C-Suffix.`,
                emojiForIcon: `Rendert das passende Emoji für den icon-Key.`,
                emojiFallback: `Fällt für unbekannte icon-Keys auf das Thermometer-Emoji zurück.`,
                conditionGerman: `Übersetzt den condition-Key standardmäßig ins Deutsche.`,
                conditionOverride: `Überschreibt Condition-Labels via strings-Prop.`,
                precip60Preferred: `Bevorzugt precipitation_60 vor precipitation für den Header-Chip.`,
                precipFallback: `Fällt auf precipitation zurück, wenn precipitation_60 fehlt.`,
                precipOmittedWhenZero: `Lässt den Niederschlag-Chip weg, wenn der Wert 0 ist.`,
                wind60Preferred: `Bevorzugt wind_speed_60 vor wind_speed für den Header-Chip.`,
                collapsedByDefault: `Ist standardmäßig eingeklappt (Extras + Vorhersage nicht im DOM).`,
                extrasOnExpand: `Klappt beim Klick auf und rendert die Extras-Reihe, wenn Extras gesetzt sind.`,
                noExtrasRow: `Lässt die Extras-Reihe weg, wenn keine Extras gesetzt sind.`,
                forecastColumns: `Rendert pro Tag eine Spalte mit Wochentag + Emoji + Min/Max.`,
                rainChipPositive: `Rendert den Regen-Wahrscheinlichkeits-Chip nur bei positivem Wert.`,
                attributionWithForecast: `Rendert die Attribution innerhalb der Vorhersage-Sektion, wenn beide vorhanden.`,
                attributionWithoutForecast: `Rendert die Attribution trotzdem, wenn keine Vorhersage übergeben wurde (nur Extras-Reihe).`,
                firesOnOpenChange: `Feuert onOpenChange beim Toggle der Disclosure.`,
                controllableOpen: `Voll kontrollierbar via open + onOpenChange.`,
                defaultOpen: `defaultOpen rendert den Body sofort beim ersten Paint.`,
                disclosureAriaLabel: `Disclosure-Button setzt das richtige aria-label pro Zustand.`,
                disabledWhenEmpty: `Deaktiviert die Disclosure, wenn es keinen Body-Inhalt gibt (keine Extras / keine Vorhersage / keine Attribution).`,
                chevronHiddenWhenDisabled: `Blendet das Chevron aus, wenn die Disclosure deaktiviert ist (Header-Only-Modus).`,
                enabledWithAttributionOnly: `Aktiviert die Disclosure, wenn nur attribution gesetzt ist (es gibt noch etwas aufzuklappen).`,
                extrasTooltipsTranslated: `Extras-Chips tragen die übersetzten Tooltip-Labels.`,
                regionAriaLabel: `Region trägt das übersetzte aria-label.`,
                emojiVocabulary: `resolveWeatherEmoji liefert die volle Vokabular-Map (Port-Parität).`,
                lucideIconMode: `Rendert ein monochromes Lucide-Icon, wenn glyphStyle="icon".`,
                emojiDefault: `Behält die Emoji-Darstellung, wenn glyphStyle weggelassen wird.`,
                fahrenheitConversion: `Wandelt die Temperatur in Fahrenheit um, wenn temperatureUnit="fahrenheit".`,
                kelvinConversion: `Wandelt die Temperatur in Kelvin um, wenn temperatureUnit="kelvin".`,
                forecastUnitConversion: `Min/Max in der Vorhersage folgen der gewählten temperatureUnit.`
            }
        },
        rtl: {
            title: `RTL`,
            body: `Unter dir="rtl" spiegelt sich das Header-Layout via Flex-Utilities — Emoji + Temperatur wandern an die führende Kante, Niederschlag- und Wind-Chips sowie Chevron an die nacheilende. Der Vorhersage-Strip bleibt in beiden Richtungen ein horizontaler Scroll.`
        },
        apiReference: {
            title: `API-Referenz`,
            intro: `Props, die <WeatherExpandable> akzeptiert.`
        }
    }
};
