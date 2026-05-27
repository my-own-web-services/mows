/**
 * Translation slice for the Steps component (examples + DocPage).
 *
 * Owning the type AND both locale literals in one place keeps every
 * string for a feature reviewable in a single file. The top-level
 * Translation interface in src/languages.ts references the type
 * exported here, and the top-level locale files (en-US.ts / de.ts)
 * spread the value exports — so adding a key here forces both
 * languages to fill it (tsc + the : Translation annotation in the
 * locale files do the work).
 */

interface ExampleEntry {
  title: string;
  description: string;
}

interface DocInstallation {
  title: string;
  commandTab: string;
  manualTab: string;
  manualStep1: string;
  manualStep2: string;
  manualStep3: string;
}

interface DocSectionBody {
  title: string;
  body: string;
}

export interface StepsTranslation {
  horizontal: ExampleEntry;
  endAlignment: ExampleEntry;
  vertical: ExampleEntry;
  statusOverride: ExampleEntry;
  wizard: ExampleEntry;
  loading: ExampleEntry;
  disabled: ExampleEntry;
  icons: ExampleEntry;
  rtl: ExampleEntry;
  selection: ExampleEntry;
  doc: {
    installation: DocInstallation;
    usage: DocSectionBody;
    composition: DocSectionBody;
    examples: {
      title: string;
      line: ExampleEntry;
      endAlignment: ExampleEntry;
      vertical: ExampleEntry;
      loading: ExampleEntry;
      disabled: ExampleEntry;
      icons: ExampleEntry;
    };
    definedBehaviour: {
      title: string;
      intro: string;
      verifiedBy: string;
      statements: {
        derivesStatuses: string;
        ariaCurrent: string;
        rendersTitleDescription: string;
        orientationAttr: string;
        statusOverride: string;
        selectionNoCompleted: string;
        selectionShowsNumbers: string;
        throwsOutsideSteps: string;
        endAlignmentSide: string;
        endAlignmentCenter: string;
        loadingIndeterminate: string;
        loadingDeterminate: string;
      };
    };
    rtl: DocSectionBody;
    apiReference: { title: string; intro: string };
  };
}

export const stepsEn: StepsTranslation = {
  horizontal: {
    title: `Horizontal stepper`,
    description: `Default horizontal layout. Status is derived from the controlled "current" index.`,
  },
  endAlignment: {
    title: `End alignment`,
    description: `endAlignment toggles how the first and last steps anchor along the row. "side" (default) pushes them to the row edges with left/right label alignment; "center" centers every label under its indicator. In both modes the indicators stay evenly spaced.`,
  },
  vertical: {
    title: `Vertical stepper`,
    description: `Stack the steps vertically, with the connector running between indicators.`,
  },
  statusOverride: {
    title: `Per-step status override`,
    description: `Pass "status" on an individual <Step> to force its rendering, ignoring the derived state.`,
  },
  wizard: {
    title: `Wizard (preview + content)`,
    description: `Pair <Steps> with content panels and Back/Next buttons for a real-world flow.`,
  },
  selection: {
    title: `Selection mode`,
    description: `mode="selection" turns the stepper into a step picker: every circle shows its number, the active step is filled with the primary color, and there is no notion of completion.`,
  },
  loading: {
    title: `Loading`,
    description: `Per-step loading state. Pass loading={true} for an indeterminate spinner around the indicator, or loading={n} (0–100) for a determinate progress ring driven by your own state.`,
  },
  disabled: {
    title: `Disabled`,
    description: `The whole stepper rendered in a disabled state — muted and non-interactive — using a wrapping container with aria-disabled and pointer-events-none.`,
  },
  icons: {
    title: `Icons`,
    description: `Step titles accept any ReactNode, so you can prefix each label with an icon without modifying the <Steps> primitive itself.`,
  },
  rtl: {
    title: `RTL`,
    description: `Wrapping <Steps> in dir="rtl" flips the layout for right-to-left scripts. Both horizontal and vertical orientations follow.`,
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
      body: `Import <Steps> and <Step> from the package and render them with a controlled "current" prop. <Step> reads orientation and current from the surrounding <Steps> via context, so its children must be direct <Step> elements.`,
    },
    composition: {
      title: `Composition`,
      body: `<Steps> is a thin layout that wires context to its children. Each <Step> renders an indicator circle and a label. The status of each step (completed / current / upcoming) is derived from its index relative to "current", but can be overridden per-step via the "status" prop for error or skipped states.`,
    },
    examples: {
      title: `Examples`,
      line: {
        title: `Line`,
        description: `The default horizontal layout: a numbered indicator per step, joined by a connector line.`,
      },
      endAlignment: {
        title: `End alignment`,
        description: `Side-by-side comparison of endAlignment="side" (first/last labels at the row edges) and endAlignment="center" (every label centered). Indicators stay evenly spaced in both.`,
      },
      vertical: {
        title: `Vertical`,
        description: `Stack the steps vertically with the connector running between indicators.`,
      },
      loading: {
        title: `Loading`,
        description: `Side-by-side comparison of loading={true} (indeterminate spinner) and loading={n} (determinate progress ring driven by component state).`,
      },
      disabled: {
        title: `Disabled`,
        description: `The stepper rendered as fully disabled — muted and non-interactive.`,
      },
      icons: {
        title: `Icons`,
        description: `Use a ReactNode title to put an icon next to each step's label.`,
      },
    },
    definedBehaviour: {
      title: `Defined behaviour`,
      intro: `Statements describing how <Steps> is expected to behave, each linked to the test that verifies it. The path/line points at lib/components/ui/steps.test.tsx in this package.`,
      verifiedBy: `verified by`,
      statements: {
        derivesStatuses: `Index < current renders as completed, == current renders as current, > current renders as upcoming.`,
        ariaCurrent: `The step at "current" carries aria-current="step".`,
        rendersTitleDescription: `<Step> renders its title and optional description as written.`,
        orientationAttr: `The <ol> reflects orientation via the aria-orientation attribute.`,
        statusOverride: `Passing "status" on a <Step> overrides the index-derived status.`,
        selectionNoCompleted: `In mode="selection", indices before "current" are never marked completed.`,
        selectionShowsNumbers: `In mode="selection", every indicator shows its step number; no check icons.`,
        throwsOutsideSteps: `Rendering <Step> outside a <Steps> throws a descriptive error.`,
        endAlignmentSide: `With endAlignment="side" the first step's label is left-aligned and the last step's label is right-aligned, while middle labels stay centered.`,
        endAlignmentCenter: `With endAlignment="center" every step's label is centered under its indicator, including the first and last.`,
        loadingIndeterminate: `Passing loading on a <Step> wraps the indicator in an indeterminate spinner ring.`,
        loadingDeterminate: `Passing loading={n} (0–100, clamped) wraps the indicator in a determinate progress ring exposed as role="progressbar" with aria-valuenow.`,
      },
    },
    rtl: {
      title: `RTL`,
      body: `The stepper inherits direction from its DOM ancestor: wrap it in dir="rtl" and the indicator order, label alignment, and connector all reverse without any prop changes.`,
    },
    apiReference: {
      title: `API Reference`,
      intro: `Props accepted by <Steps> and <Step>.`,
    },
  },
};

export const stepsDe: StepsTranslation = {
  horizontal: {
    title: `Horizontale Schrittanzeige`,
    description: `Standardmäßige horizontale Anordnung. Der Status wird aus dem kontrollierten „current“-Index abgeleitet.`,
  },
  endAlignment: {
    title: `End-Ausrichtung`,
    description: `endAlignment steuert, wie sich der erste und letzte Schritt entlang der Reihe verankern. „side“ (Standard) drückt sie an die Reihenränder mit links-/rechtsbündigem Label; „center“ zentriert jedes Label unter seinem Indikator. In beiden Modi bleiben die Indikatoren gleichmäßig verteilt.`,
  },
  vertical: {
    title: `Vertikale Schrittanzeige`,
    description: `Schritte vertikal stapeln, mit der Verbindungslinie zwischen den Indikatoren.`,
  },
  statusOverride: {
    title: `Status pro Schritt überschreiben`,
    description: `Übergib „status“ an einen einzelnen <Step>, um seine Darstellung unabhängig vom abgeleiteten Zustand zu erzwingen.`,
  },
  wizard: {
    title: `Assistent (Vorschau + Inhalt)`,
    description: `<Steps> mit Inhaltsbereich und Zurück/Weiter-Schaltflächen für einen realen Ablauf kombinieren.`,
  },
  selection: {
    title: `Auswahlmodus`,
    description: `mode="selection" macht aus der Schrittanzeige eine Schrittauswahl: jeder Kreis zeigt seine Nummer, der aktive Schritt ist mit der Primärfarbe gefüllt, und es gibt kein Konzept von „abgeschlossen“.`,
  },
  loading: {
    title: `Ladezustand`,
    description: `Ladezustand pro Schritt. loading={true} ergibt einen unbestimmten Spinner um den Indikator; loading={n} (0–100) ergibt einen Fortschrittsring, den du aus eigenem State speist.`,
  },
  disabled: {
    title: `Deaktiviert`,
    description: `Die gesamte Schrittanzeige im deaktivierten Zustand — gedämpft und nicht interaktiv — mittels eines Containers mit aria-disabled und pointer-events-none.`,
  },
  icons: {
    title: `Icons`,
    description: `Step-Titel akzeptieren beliebige ReactNode-Werte, sodass jedem Label ein Icon vorangestellt werden kann, ohne das <Steps>-Primitiv anzupassen.`,
  },
  rtl: {
    title: `RTL`,
    description: `<Steps> in dir="rtl" einzuschließen dreht das Layout für rechtsläufige Schriften. Horizontale und vertikale Ausrichtung folgen beide.`,
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
      body: `Importiere <Steps> und <Step> aus dem Paket und rendere sie mit einer kontrollierten „current“-Prop. <Step> liest Ausrichtung und current über Context aus dem umgebenden <Steps>; die Kinder müssen daher direkte <Step>-Elemente sein.`,
    },
    composition: {
      title: `Komposition`,
      body: `<Steps> ist ein schlankes Layout, das Context an seine Kinder weiterleitet. Jeder <Step> rendert einen Indikatorkreis und ein Label. Der Status pro Schritt (completed / current / upcoming) wird aus dem Index relativ zu „current“ abgeleitet, lässt sich aber per „status“-Prop überschreiben, etwa für Fehler- oder Übersprungszustände.`,
    },
    examples: {
      title: `Beispiele`,
      line: {
        title: `Linie`,
        description: `Das voreingestellte horizontale Layout: ein nummerierter Indikator pro Schritt, verbunden durch eine Linie.`,
      },
      endAlignment: {
        title: `End-Ausrichtung`,
        description: `Direkter Vergleich von endAlignment="side" (erstes/letztes Label an den Reihenrändern) und endAlignment="center" (jedes Label zentriert). In beiden bleiben die Indikatoren gleichmäßig verteilt.`,
      },
      vertical: {
        title: `Vertikal`,
        description: `Schritte vertikal stapeln, mit der Verbindungslinie zwischen den Indikatoren.`,
      },
      loading: {
        title: `Ladezustand`,
        description: `Direkter Vergleich von loading={true} (unbestimmter Spinner) und loading={n} (bestimmter Fortschrittsring, gespeist aus Komponentenstate).`,
      },
      disabled: {
        title: `Deaktiviert`,
        description: `Die Schrittanzeige vollständig deaktiviert dargestellt — gedämpft und nicht interaktiv.`,
      },
      icons: {
        title: `Icons`,
        description: `Ein ReactNode-Titel ermöglicht es, jedem Step-Label ein Icon voranzustellen.`,
      },
    },
    definedBehaviour: {
      title: `Festgelegtes Verhalten`,
      intro: `Aussagen darüber, wie sich <Steps> verhalten soll, jeweils mit Verweis auf den Test, der das Verhalten absichert. Die Pfade verweisen auf lib/components/ui/steps.test.tsx in diesem Paket.`,
      verifiedBy: `geprüft durch`,
      statements: {
        derivesStatuses: `Index < current ergibt completed, == current ergibt current, > current ergibt upcoming.`,
        ariaCurrent: `Der Schritt bei „current“ trägt aria-current="step".`,
        rendersTitleDescription: `<Step> rendert Titel und optionale Beschreibung wie angegeben.`,
        orientationAttr: `Die <ol> spiegelt die Ausrichtung über das Attribut aria-orientation wider.`,
        statusOverride: `Ein „status“-Prop auf einem <Step> überschreibt den aus dem Index abgeleiteten Status.`,
        selectionNoCompleted: `Im mode="selection" werden Indizes vor „current“ niemals als completed markiert.`,
        selectionShowsNumbers: `Im mode="selection" zeigt jeder Indikator seine Schrittnummer; keine Check-Icons.`,
        throwsOutsideSteps: `<Step> außerhalb von <Steps> zu rendern wirft einen aussagekräftigen Fehler.`,
        endAlignmentSide: `Mit endAlignment="side" ist das Label des ersten Schritts linksbündig und das des letzten rechtsbündig; mittlere Labels bleiben zentriert.`,
        endAlignmentCenter: `Mit endAlignment="center" ist das Label jedes Schritts unter seinem Indikator zentriert — auch das erste und das letzte.`,
        loadingIndeterminate: `loading auf einem <Step> umrahmt den Indikator mit einem unbestimmten Spinner-Ring.`,
        loadingDeterminate: `loading={n} (0–100, geklemmt) umrahmt den Indikator mit einem Fortschrittsring, der als role="progressbar" mit aria-valuenow exponiert wird.`,
      },
    },
    rtl: {
      title: `RTL`,
      body: `Die Schrittanzeige erbt die Richtung von ihrem DOM-Vorfahren: ein umgebendes dir="rtl" kehrt Indikatorreihenfolge, Label-Ausrichtung und Verbindungslinien um — ohne Prop-Änderungen.`,
    },
    apiReference: {
      title: `API-Referenz`,
      intro: `Props, die <Steps> und <Step> akzeptieren.`,
    },
  },
};
