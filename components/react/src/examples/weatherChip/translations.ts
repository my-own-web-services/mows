/**
 * Translation slice for weatherChip.
 *
 * Owns the type and both locale literals for the WeatherChip docs +
 * example surface. Edits to weatherChip's strings happen here; the
 * top-level Translation interface and locale files just reference
 * these exports.
 *
 * The chip's *runtime* strings (condition labels, mode labels, units)
 * live with the component as `DEFAULT_WEATHER_CHIP_STRINGS` and are
 * overridden per-instance through the `strings` prop — this file
 * covers doc/example surface text only.
 */

export interface WeatherChipTranslation {
  current: { title: string; description: string };
  forecast: { title: string; description: string };
  historical: { title: string; description: string };
  loading: { title: string; description: string };
  error: { title: string; description: string };
  empty: { title: string; description: string };
  overMap: { title: string; description: string };
  localised: { title: string; description: string };
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
      current: { title: string; description: string };
      forecast: { title: string; description: string };
      historical: { title: string; description: string };
      loading: { title: string; description: string };
      error: { title: string; description: string };
      empty: { title: string; description: string };
      overMap: { title: string; description: string };
      localised: { title: string; description: string };
    };
    definedBehaviour: {
      title: string;
      intro: string;
      verifiedBy: string;
      statements: {
        defaultPlaceholder: string;
        roundsTemperature: string;
        translatesCondition: string;
        historicalLabel: string;
        forecastLabel: string;
        currentFallback: string;
        metricsOptional: string;
        loadingIndicator: string;
        errorAlert: string;
        attribution: string;
        formatTimeOverride: string;
        formatTemperatureOverride: string;
        timestampInputs: string;
        dataModeAttribute: string;
      };
    };
    rtl: { title: string; body: string };
    apiReference: { title: string; intro: string };
  };
}

export const weatherChipEn: WeatherChipTranslation = {
  current: {
    title: `Current weather`,
    description: `Footer shows the "Now" label. The chip is data-source agnostic — feed it any structured record. The values shown here are fabricated demo data.`,
  },
  forecast: {
    title: `Forecast`,
    description: `Pass mode="forecast" with a future timestamp. The footer prefixes the formatted time with the localised forecast label.`,
  },
  historical: {
    title: `Historical`,
    description: `Pass mode="historical" with a past timestamp. The footer prefixes the formatted time with the localised history label.`,
  },
  loading: {
    title: `Loading`,
    description: `loading={true} renders a small pulsing dot next to the time label. Existing data stays visible so the chip doesn't flicker between fetches.`,
  },
  error: {
    title: `Error`,
    description: `Pass an error string to surface it beneath the metrics row with role="alert" and the destructive accent.`,
  },
  empty: {
    title: `No data`,
    description: `Omit data to render the placeholder layout — useful when the surrounding feature is disabled or the first fetch hasn't returned yet.`,
  },
  overMap: {
    title: `Overlaid on a Map`,
    description: `Position the chip absolutely over a <Map>. Place it inside the same relative container; the chip is layout-agnostic on its own.`,
  },
  localised: {
    title: `Localised strings`,
    description: `Override condition labels, mode prefixes, and unit suffixes via the strings prop. Anything not overridden falls back to DEFAULT_WEATHER_CHIP_STRINGS.`,
  },
  rtl: {
    title: `Right-to-left`,
    description: `Wrapped in dir="rtl". The chip's metrics row and footer reverse direction; numbers stay LTR thanks to tabular-nums + intl formatting.`,
  },
  doc: {
    installation: {
      title: `Installation`,
      commandTab: `Command`,
      manualTab: `Manual`,
      manualStep1: `Install the following dependencies:`,
      manualStep2: `Copy and paste the following code into your project.`,
      manualStep3: `Update the import paths to match your project setup.`,
    },
    usage: {
      title: `Usage`,
      body: `<WeatherChip> is a glass-card readout for a single weather sample. Fetch the data however you like — the library does not bundle a fetcher or imply a specific provider — forward it as the data prop, and the chip handles icon resolution, formatting, and i18n.`,
    },
    composition: {
      title: `Composition`,
      body: `The chip renders inline-block — positioning is the consumer's job. Drop it absolutely over a <Map>, into a sidebar, or stack several to compose a small forecast strip. Pass mode and at to drive the footer; pass loading/error to surface fetch state without re-mounting the chip.`,
    },
    examples: {
      title: `Examples`,
      current: {
        title: `Current weather`,
        description: `Default mode. Footer reads "Now".`,
      },
      forecast: {
        title: `Forecast`,
        description: `Future-dated sample with the forecast prefix in the footer.`,
      },
      historical: {
        title: `Historical`,
        description: `Past-dated sample with the history prefix in the footer.`,
      },
      loading: {
        title: `Loading`,
        description: `Fetch in flight — pulsing dot, existing data stays put.`,
      },
      error: {
        title: `Error`,
        description: `Upstream failed — message surfaced with role="alert".`,
      },
      empty: {
        title: `No data`,
        description: `Placeholder layout while the consumer hasn't loaded data yet.`,
      },
      overMap: {
        title: `Overlaid on a Map`,
        description: `Absolutely-positioned inside a relative <Map> wrapper.`,
      },
      localised: {
        title: `Localised strings`,
        description: `German labels via the strings prop.`,
      },
    },
    definedBehaviour: {
      title: `Defined behaviour`,
      intro: `Statements describing how <WeatherChip> is expected to behave, each linked to the test that verifies it.`,
      verifiedBy: `verified by`,
      statements: {
        defaultPlaceholder: `Renders the placeholder dash when no data is provided.`,
        roundsTemperature: `Rounds the temperature to an integer and appends the °C unit.`,
        translatesCondition: `Translates the condition key into the matching label from the strings prop.`,
        historicalLabel: `Historical mode prefixes the formatted timestamp with the "History" label.`,
        forecastLabel: `Forecast mode prefixes the formatted timestamp with the "Forecast" label.`,
        currentFallback: `Falls back to the current-mode label when no timestamp is supplied.`,
        metricsOptional: `Renders precipitation / wind / humidity only when their values are numbers.`,
        loadingIndicator: `Shows a loading indicator with the localised aria-label when loading is true.`,
        errorAlert: `Surfaces the error string with role="alert" and data-state="error".`,
        attribution: `Renders the supplied attribution node beneath the chip.`,
        formatTimeOverride: `Honours the consumer's formatTimeLabel override.`,
        formatTemperatureOverride: `Honours the consumer's formatTemperature override.`,
        timestampInputs: `Accepts a Date, a numeric epoch, or an ISO-string timestamp.`,
        dataModeAttribute: `Exposes data-mode on the root for downstream styling.`,
      },
    },
    rtl: {
      title: `RTL`,
      body: `The chip renders inside dir="rtl" with the metrics row mirrored. Numbers stay LTR thanks to tabular-nums and the Intl formatter's locale-aware output.`,
    },
    apiReference: {
      title: `API Reference`,
      intro: `Props accepted by <WeatherChip>.`,
    },
  },
};

export const weatherChipDe: WeatherChipTranslation = {
  current: {
    title: `Aktuelles Wetter`,
    description: `Im Footer steht „Aktuell". Die Komponente ist datenquellen-agnostisch — übergib einen strukturierten Datensatz. Die hier gezeigten Werte sind erfundene Demo-Daten.`,
  },
  forecast: {
    title: `Vorhersage`,
    description: `Mit mode="forecast" und zukünftigem Zeitstempel. Der Footer ergänzt den lokalisierten Vorhersage-Präfix vor der formatierten Zeit.`,
  },
  historical: {
    title: `Verlauf`,
    description: `Mit mode="historical" und vergangenem Zeitstempel. Der Footer ergänzt den lokalisierten Verlauf-Präfix vor der formatierten Zeit.`,
  },
  loading: {
    title: `Wird geladen`,
    description: `loading={true} zeigt einen kleinen pulsierenden Punkt neben dem Zeit-Label. Vorhandene Daten bleiben sichtbar, damit die Komponente nicht zwischen Fetches flackert.`,
  },
  error: {
    title: `Fehler`,
    description: `Ein Fehler-String wird unterhalb der Kennzahlen mit role="alert" und destruktiver Farbgebung dargestellt.`,
  },
  empty: {
    title: `Keine Daten`,
    description: `Ohne data wird der Platzhalter-Layout gerendert — nützlich, wenn das Feature deaktiviert ist oder der erste Fetch noch nicht zurück ist.`,
  },
  overMap: {
    title: `Überlagert auf einer Karte`,
    description: `Die Komponente absolut über einer <Map> platzieren. In denselben relativen Container setzen; die Positionierung übernimmt der Konsument.`,
  },
  localised: {
    title: `Lokalisierte Strings`,
    description: `Bedingungs-Labels, Modus-Präfixe und Einheiten lassen sich über den strings-Prop überschreiben. Alles, was nicht überschrieben wird, fällt auf DEFAULT_WEATHER_CHIP_STRINGS zurück.`,
  },
  rtl: {
    title: `Rechts-nach-links`,
    description: `Mit dir="rtl" umschlossen. Die Kennzahlenzeile und der Footer kehren ihre Richtung um; Zahlen bleiben LTR dank tabular-nums und Intl-Formatierung.`,
  },
  doc: {
    installation: {
      title: `Installation`,
      commandTab: `Befehl`,
      manualTab: `Manuell`,
      manualStep1: `Installiere die folgenden Abhängigkeiten:`,
      manualStep2: `Kopiere den folgenden Code in dein Projekt.`,
      manualStep3: `Passe die Importpfade an dein Projekt an.`,
    },
    usage: {
      title: `Verwendung`,
      body: `<WeatherChip> ist eine Glass-Card-Anzeige für einen einzelnen Wetterdatensatz. Die Bibliothek bündelt keinen Fetcher und impliziert keinen Anbieter — hole dir die Daten beliebig, übergib sie als data-Prop, und die Komponente kümmert sich um Icon-Auflösung, Formatierung und i18n.`,
    },
    composition: {
      title: `Komposition`,
      body: `Die Komponente rendert als inline-block — die Positionierung übernimmt der Konsument. Absolut über einer <Map>, in einer Seitenleiste oder gestapelt als Mini-Vorhersage. mode und at steuern den Footer; loading/error spiegeln den Fetch-Status, ohne die Komponente neu zu mounten.`,
    },
    examples: {
      title: `Beispiele`,
      current: {
        title: `Aktuelles Wetter`,
        description: `Standardmodus. Footer zeigt "Aktuell".`,
      },
      forecast: {
        title: `Vorhersage`,
        description: `Zukünftiger Datensatz mit Vorhersage-Präfix im Footer.`,
      },
      historical: {
        title: `Verlauf`,
        description: `Vergangener Datensatz mit Verlauf-Präfix im Footer.`,
      },
      loading: {
        title: `Wird geladen`,
        description: `Fetch läuft — pulsierender Punkt, vorhandene Daten bleiben sichtbar.`,
      },
      error: {
        title: `Fehler`,
        description: `Upstream fehlgeschlagen — Meldung mit role="alert".`,
      },
      empty: {
        title: `Keine Daten`,
        description: `Platzhalter-Layout, solange der Konsument noch keine Daten geladen hat.`,
      },
      overMap: {
        title: `Überlagert auf einer Karte`,
        description: `Absolut positioniert in einem relativen <Map>-Wrapper.`,
      },
      localised: {
        title: `Lokalisierte Strings`,
        description: `Deutsche Labels über den strings-Prop.`,
      },
    },
    definedBehaviour: {
      title: `Festgelegtes Verhalten`,
      intro: `Aussagen darüber, wie sich <WeatherChip> verhalten soll, jeweils mit Verweis auf den Test.`,
      verifiedBy: `geprüft durch`,
      statements: {
        defaultPlaceholder: `Rendert den Platzhalter-Strich, wenn keine Daten übergeben werden.`,
        roundsTemperature: `Rundet die Temperatur auf eine Ganzzahl und hängt die °C-Einheit an.`,
        translatesCondition: `Übersetzt den Condition-Key in das passende Label aus dem strings-Prop.`,
        historicalLabel: `Im historical-Modus wird dem formatierten Zeitstempel der "Verlauf"-Präfix vorangestellt.`,
        forecastLabel: `Im forecast-Modus wird dem formatierten Zeitstempel der "Vorhersage"-Präfix vorangestellt.`,
        currentFallback: `Fällt auf das current-Label zurück, wenn kein Zeitstempel übergeben wird.`,
        metricsOptional: `Rendert Niederschlag / Wind / Luftfeuchte nur, wenn deren Werte Zahlen sind.`,
        loadingIndicator: `Zeigt eine Lade-Anzeige mit lokalisiertem aria-label, wenn loading true ist.`,
        errorAlert: `Zeigt den Fehler-String mit role="alert" und data-state="error".`,
        attribution: `Rendert den übergebenen attribution-Knoten unter der Komponente.`,
        formatTimeOverride: `Respektiert das formatTimeLabel-Override des Konsumenten.`,
        formatTemperatureOverride: `Respektiert das formatTemperature-Override des Konsumenten.`,
        timestampInputs: `Akzeptiert ein Date, einen numerischen Epoch oder einen ISO-String als Zeitstempel.`,
        dataModeAttribute: `Belegt data-mode am Root-Element für Downstream-Styling.`,
      },
    },
    rtl: {
      title: `RTL`,
      body: `Die Komponente rendert in dir="rtl" mit gespiegelter Kennzahlenzeile. Zahlen bleiben LTR dank tabular-nums und der locale-abhängigen Intl-Formatierung.`,
    },
    apiReference: {
      title: `API-Referenz`,
      intro: `Props, die <WeatherChip> akzeptiert.`,
    },
  },
};
