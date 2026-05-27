import * as React from "react";
import CodeViewer from "../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../lib/components/code/expandableCode/ExpandableCode";
import { type PageIndexItem } from "../../lib/components/navigation/pageIndex/PageIndex";
import { MowsContext } from "../../lib/lib/mowsContext/MowsContext";
import { DocPage, DocSection, DocSubsection } from "../examples/harness/docPage";

const ANCHOR = {
    overview: `overview`,
    overviewBase: `overview-base`,
    overviewTranslation: `overview-translation`,
    overviewLanguage: `overview-language`,
    overviewProvider: `overview-provider`,
    setup: `setup`,
    setupMount: `setup-mount`,
    setupDefaults: `setup-defaults`,
    reading: `reading`,
    readingHooks: `reading-hooks`,
    readingClass: `reading-class`,
    readingActions: `reading-actions`,
    extending: `extending`,
    extendingDeclare: `extending-declare`,
    extendingLocale: `extending-locale`,
    extendingConsume: `extending-consume`,
    slicing: `slicing`,
    slicingFile: `slicing-file`,
    slicingWiring: `slicing-wiring`,
    slicingBundle: `slicing-bundle`,
    switching: `switching`,
    switchingRuntime: `switching-runtime`,
    switchingChunks: `switching-chunks`,
    safety: `safety`,
    safetyCompile: `safety-compile`,
    safetyTest: `safety-test`,
    conventions: `conventions`,
    conventionsNamespace: `conventions-namespace`,
    conventionsFlat: `conventions-flat`,
    conventionsActions: `conventions-actions`,
    conventionsSpread: `conventions-spread`
} as const;

const BASE_TRANSLATION_SNIPPET = `// lib/lib/languages.ts — the library's own contract
export interface BaseTranslation {
    primaryMenu: {
        login: string;
        logout: string;
        // …
    };
    commandPalette: {
        placeholder: string;
        noResults: string;
        // …
    };
    actions: {
        // Action labels are the one open-ended slot — keys are namespaced
        // strings chosen by the caller (e.g. "myapp.document.create").
        [key: string]: string;
    };
    // …
}

// Apps extend this — declaration merging adds their keys to the same tree.
export interface Translation extends BaseTranslation {}`;

const LANGUAGE_SNIPPET = `// lib/lib/languages.ts
export interface Language {
    code: string;            // "en-US", "de"
    originalName: string;    // "English (US)", "Deutsch"
    englishName: string;
    emoji: string;
    // Dynamic import: Vite splits this into a separate chunk per locale.
    import: () => Promise<{ default: Translation }>;
}`;

const PROVIDER_MOUNT_SNIPPET = `import { MowsProvider } from "@mows/react-components";
import { languages, type Translation } from "./languages";
import enTranslation from "./languages/en-US";
import deTranslation from "./languages/de";

const STORAGE_PREFIX = "my-app";

// Bundle the picked initial locale eagerly so the first paint never
// flashes English while the chunk loads.
const eagerTranslations: Record<string, Translation> = {
    "en-US": enTranslation,
    de: deTranslation
};

const pickInitialTranslation = (): Translation => {
    const stored = localStorage.getItem(\`\${STORAGE_PREFIX}_language\`);
    if (stored && eagerTranslations[stored]) return eagerTranslations[stored];
    const browser = navigator.language;
    if (eagerTranslations[browser]) return eagerTranslations[browser];
    const base = browser.split("-")[0];
    if (eagerTranslations[base]) return eagerTranslations[base];
    return enTranslation;
};

createRoot(document.getElementById("root")!).render(
    <MowsProvider
        storagePrefix={STORAGE_PREFIX}
        languages={languages}
        initialTranslation={pickInitialTranslation()}
    >
        <App />
    </MowsProvider>
);`;

const LANGUAGE_LIST_SNIPPET = `// src/languages.ts — the Language[] you pass to <MowsProvider>
import type { Language } from "@mows/react-components";

export const languages: Language[] = [
    {
        code: "en-US",
        originalName: "English (US)",
        englishName: "English (US)",
        emoji: "🇺🇸",
        // Each import() resolves to YOUR extended Translation, not the
        // library's bare BaseTranslation. That's why you can't just reuse
        // baseLanguages once you've added app-side keys.
        import: () => import("./languages/en-US").then((m) => ({ default: m.default }))
    },
    {
        code: "de",
        originalName: "Deutsch",
        englishName: "German",
        emoji: "🇩🇪",
        import: () => import("./languages/de").then((m) => ({ default: m.default }))
    }
];`;

const READ_HOOK_SNIPPET = `import { useMows } from "@mows/react-components";

export const Greeting = () => {
    const { t } = useMows();
    // Typed end-to-end: tsc errors if t.dashboard.greeting doesn't exist.
    return <h1>{t.dashboard.greeting}</h1>;
};`;

const READ_CLASS_SNIPPET = `import { Component, type ContextType } from "react";
import { MowsContext } from "@mows/react-components";

export class Greeting extends Component {
    static contextType = MowsContext;
    declare context: ContextType<typeof MowsContext>;

    render = () => {
        // this.context is typed against MowsContextType — the same dot-path
        // completion you get from useMows().
        return <h1>{this.context!.t.dashboard.greeting}</h1>;
    };
}`;

const READ_ACTION_SNIPPET = `// Define your action ids in one place — namespaced strings, ideally an enum.
export enum AppActionIds {
    CREATE_DOCUMENT = "myapp.document.create"
}

// In each locale file, fill the label under \`actions\`:
const translation: Translation = {
    ...baseEn,
    actions: {
        ...baseEn.actions,
        [AppActionIds.CREATE_DOCUMENT]: "Create document"
    },
    // …
};

// Read at call sites the same way — looked up dynamically, but the id
// comes from the enum so a typo stays a typo at both ends.
const label = t.actions[AppActionIds.CREATE_DOCUMENT];`;

const DECLARE_MERGE_SNIPPET = `// src/languages.ts in your app
import {
    type Language as MowsLanguage,
    type Translation as MowsTranslation
} from "@mows/react-components";

// eslint-disable-next-line quotes
declare module "@mows/react-components" {
    interface Translation {
        // Group by feature, not by component — these keys outlive
        // component renames.
        dashboard: {
            greeting: string;
            empty: string;
        };
        settings: {
            appearance: {
                title: string;
                description: string;
            };
        };
    }
}

export type Translation = MowsTranslation;
export type Language = MowsLanguage;`;

const LOCALE_FILE_SNIPPET = `// src/languages/en-US.ts
import baseEn from "@mows/react-components/lib/languages/en-US/default";
import type { Translation } from "../languages";

// const annotation forces tsc to check every required key is present —
// add a key to Translation without filling it here and this assignment
// fails to compile.
const translation: Translation = {
    ...baseEn,          // every library string keeps its baseline value
    actions: {
        ...baseEn.actions
        // app actions go here
    },
    dashboard: {
        greeting: "Welcome back",
        empty: "Nothing to show yet."
    },
    settings: {
        appearance: {
            title: "Appearance",
            description: "Theme and density."
        }
    }
};

export default translation;`;

const SLICE_FILE_SNIPPET = `// src/examples/steps/translations.ts — co-located with the component.
// One file owns the type AND both locale literals for this feature.

interface ExampleEntry {
    title: string;
    description: string;
}

export interface StepsTranslation {
    horizontal: ExampleEntry;
    endAlignment: ExampleEntry;
    // …all the example/doc keys for <Steps>
    doc: {
        installation: { title: string; commandTab: string /* … */ };
        usage: { title: string; body: string };
        // …
    };
}

export const stepsEn: StepsTranslation = {
    horizontal: { title: "Horizontal stepper", description: "Default …" },
    endAlignment: { title: "End alignment", description: "endAlignment …" },
    // …
    doc: { installation: { title: "Installation", commandTab: "Command" /* … */ }, /* … */ }
};

export const stepsDe: StepsTranslation = {
    horizontal: { title: "Horizontale Schrittanzeige", description: "Standard …" },
    endAlignment: { title: "End-Ausrichtung", description: "endAlignment …" },
    // …
    doc: { installation: { title: "Installation", commandTab: "Befehl" /* … */ }, /* … */ }
};`;

const SLICE_WIRING_SNIPPET = `// src/languages.ts
import type { StepsTranslation } from "./examples/steps/translations";

declare module "../lib/lib/languages" {
    interface Translation {
        example: {
            // …
            examples: {
                steps: StepsTranslation;        // ← the slice type plugs in here
                // …
            };
        };
    }
}

// src/languages/en-US.ts
import { stepsEn } from "../examples/steps/translations";

const translation: Translation = {
    ...baseEn,
    example: {
        // …
        examples: {
            steps: stepsEn,                     // ← the slice values plug in here
            // …
        }
    }
};

// src/languages/de.ts (mirror)
import { stepsDe } from "../examples/steps/translations";

const translation: Translation = {
    ...baseDe,
    example: { /* … */ examples: { steps: stepsDe /* … */ } }
};`;

const SLICE_BUNDLE_SNIPPET = `// Eager initial-locale load — both en-US and de end up in the main chunk.
// Pro: instant first paint in the target locale.
// Con: every user downloads every locale they don't use.
import deTranslation from "./languages/de";
import enTranslation from "./languages/en-US";

const eagerTranslations: Record<string, Translation> = {
    "en-US": enTranslation,
    de: deTranslation
};
const initial = eagerTranslations[pickLocale()] ?? enTranslation;
ReactDOM.createRoot(root).render(
    <MowsProvider initialTranslation={initial} languages={languages}>
        <App />
    </MowsProvider>
);

// Dynamic initial-locale load — Vite emits one chunk per locale.
// Pro: main chunk shrinks by the size of the non-initial locale(s).
// Con: first paint waits one microtask while the locale chunk loads.
const loadInitial = async (): Promise<Translation> => {
    const locale = pickLocale(); // returns "en-US" | "de"
    if (locale === "de") return (await import("./languages/de")).default;
    return (await import("./languages/en-US")).default;
};
loadInitial().then((initial) => {
    ReactDOM.createRoot(root).render(
        <MowsProvider initialTranslation={initial} languages={languages}>
            <App />
        </MowsProvider>
    );
});`;

const SWITCH_RUNTIME_SNIPPET = `import { useMows } from "@mows/react-components";

const LanguageButtons = () => {
    const { languages, setLanguage, currentLanguage } = useMows();
    return (
        <div>
            {languages.map((lang) => (
                <button
                    key={lang.code}
                    onClick={() => setLanguage(lang)}
                    aria-pressed={currentLanguage?.code === lang.code}
                >
                    {lang.emoji} {lang.originalName}
                </button>
            ))}
        </div>
    );
};

// In most cases you don't need this — the bundled <LanguagePicker>
// component does the same thing with built-in keyboard navigation.`;

const COMPLIANCE_TEST_SNIPPET = `// lib/lib/languages/localesAreCompliant.test.ts (mirror this pattern
// in your app to lock the property in for your own locales)
import type { BaseTranslation } from "./languages";
import enUsDefault from "./en-US/default";
import deDefault from "./de/default";

// The annotations alone do the compile-time work — vitest runs the
// type-check by virtue of the test file being part of the test suite.
const enUs: BaseTranslation = enUsDefault;
const de: BaseTranslation = deDefault;

describe("locale files satisfy BaseTranslation", () => {
    it("en-US/default exports a non-empty translation tree", () => {
        expect(Object.keys(enUs).length).toBeGreaterThan(0);
    });
    it("de/default exports a non-empty translation tree", () => {
        expect(Object.keys(de).length).toBeGreaterThan(0);
    });
});`;

const useTranslationsStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext)
        throw new Error(`<TranslationsGuide> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.guides.translations;
};

export const TranslationsGuide = () => {
    const t = useTranslationsStrings();

    const indexItems: PageIndexItem[] = React.useMemo(
        () => [
            {
                id: ANCHOR.overview,
                label: t.overview.title,
                children: [
                    { id: ANCHOR.overviewBase, label: t.overview.baseTranslation.title },
                    {
                        id: ANCHOR.overviewTranslation,
                        label: t.overview.translationInterface.title
                    },
                    { id: ANCHOR.overviewLanguage, label: t.overview.language.title },
                    { id: ANCHOR.overviewProvider, label: t.overview.provider.title }
                ]
            },
            {
                id: ANCHOR.setup,
                label: t.setup.title,
                children: [
                    { id: ANCHOR.setupMount, label: t.setup.mountProvider.title },
                    { id: ANCHOR.setupDefaults, label: t.setup.defaultLanguages.title }
                ]
            },
            {
                id: ANCHOR.reading,
                label: t.reading.title,
                children: [
                    { id: ANCHOR.readingHooks, label: t.reading.hooks.title },
                    { id: ANCHOR.readingClass, label: t.reading.classComponents.title },
                    { id: ANCHOR.readingActions, label: t.reading.actions.title }
                ]
            },
            {
                id: ANCHOR.extending,
                label: t.extending.title,
                children: [
                    { id: ANCHOR.extendingDeclare, label: t.extending.declareMerge.title },
                    { id: ANCHOR.extendingLocale, label: t.extending.perLocaleFile.title },
                    {
                        id: ANCHOR.extendingConsume,
                        label: t.extending.consumeOwnKeys.title
                    }
                ]
            },
            {
                id: ANCHOR.slicing,
                label: t.slicing.title,
                children: [
                    { id: ANCHOR.slicingFile, label: t.slicing.sliceFile.title },
                    { id: ANCHOR.slicingWiring, label: t.slicing.wiring.title },
                    { id: ANCHOR.slicingBundle, label: t.slicing.bundle.title }
                ]
            },
            {
                id: ANCHOR.switching,
                label: t.switching.title,
                children: [
                    { id: ANCHOR.switchingRuntime, label: t.switching.runtime.title },
                    { id: ANCHOR.switchingChunks, label: t.switching.chunks.title }
                ]
            },
            {
                id: ANCHOR.safety,
                label: t.safety.title,
                children: [
                    { id: ANCHOR.safetyCompile, label: t.safety.compileCheck.title },
                    { id: ANCHOR.safetyTest, label: t.safety.complianceTest.title }
                ]
            },
            {
                id: ANCHOR.conventions,
                label: t.conventions.title,
                children: [
                    {
                        id: ANCHOR.conventionsNamespace,
                        label: t.conventions.namespacing.title
                    },
                    { id: ANCHOR.conventionsFlat, label: t.conventions.flatKeys.title },
                    {
                        id: ANCHOR.conventionsActions,
                        label: t.conventions.actionIds.title
                    },
                    {
                        id: ANCHOR.conventionsSpread,
                        label: t.conventions.spreadBase.title
                    }
                ]
            }
        ],
        [
            t.overview,
            t.setup,
            t.reading,
            t.extending,
            t.slicing,
            t.switching,
            t.safety,
            t.conventions
        ]
    );

    return (
        <DocPage indexItems={indexItems}>
            <DocSection
                id={ANCHOR.overview}
                title={t.overview.title}
                description={t.overview.intro}
            >
                <DocSubsection
                    id={ANCHOR.overviewBase}
                    title={t.overview.baseTranslation.title}
                    description={t.overview.baseTranslation.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={BASE_TRANSLATION_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.overviewTranslation}
                    title={t.overview.translationInterface.title}
                    description={t.overview.translationInterface.body}
                />

                <DocSubsection
                    id={ANCHOR.overviewLanguage}
                    title={t.overview.language.title}
                    description={t.overview.language.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={LANGUAGE_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.overviewProvider}
                    title={t.overview.provider.title}
                    description={t.overview.provider.body}
                />
            </DocSection>

            <DocSection id={ANCHOR.setup} title={t.setup.title} description={t.setup.intro}>
                <DocSubsection
                    id={ANCHOR.setupMount}
                    title={t.setup.mountProvider.title}
                    description={t.setup.mountProvider.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={PROVIDER_MOUNT_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.setupDefaults}
                    title={t.setup.defaultLanguages.title}
                    description={t.setup.defaultLanguages.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={LANGUAGE_LIST_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>
            </DocSection>

            <DocSection
                id={ANCHOR.reading}
                title={t.reading.title}
                description={t.reading.intro}
            >
                <DocSubsection
                    id={ANCHOR.readingHooks}
                    title={t.reading.hooks.title}
                    description={t.reading.hooks.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={READ_HOOK_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.readingClass}
                    title={t.reading.classComponents.title}
                    description={t.reading.classComponents.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={READ_CLASS_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.readingActions}
                    title={t.reading.actions.title}
                    description={t.reading.actions.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={READ_ACTION_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>
            </DocSection>

            <DocSection
                id={ANCHOR.extending}
                title={t.extending.title}
                description={t.extending.intro}
            >
                <DocSubsection
                    id={ANCHOR.extendingDeclare}
                    title={t.extending.declareMerge.title}
                    description={t.extending.declareMerge.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={DECLARE_MERGE_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.extendingLocale}
                    title={t.extending.perLocaleFile.title}
                    description={t.extending.perLocaleFile.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={LOCALE_FILE_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.extendingConsume}
                    title={t.extending.consumeOwnKeys.title}
                    description={t.extending.consumeOwnKeys.body}
                />
            </DocSection>

            <DocSection
                id={ANCHOR.slicing}
                title={t.slicing.title}
                description={t.slicing.intro}
            >
                <DocSubsection
                    id={ANCHOR.slicingFile}
                    title={t.slicing.sliceFile.title}
                    description={t.slicing.sliceFile.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={SLICE_FILE_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.slicingWiring}
                    title={t.slicing.wiring.title}
                    description={t.slicing.wiring.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={SLICE_WIRING_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.slicingBundle}
                    title={t.slicing.bundle.title}
                    description={t.slicing.bundle.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={SLICE_BUNDLE_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>
            </DocSection>

            <DocSection
                id={ANCHOR.switching}
                title={t.switching.title}
                description={t.switching.intro}
            >
                <DocSubsection
                    id={ANCHOR.switchingRuntime}
                    title={t.switching.runtime.title}
                    description={t.switching.runtime.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={SWITCH_RUNTIME_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.switchingChunks}
                    title={t.switching.chunks.title}
                    description={t.switching.chunks.body}
                />
            </DocSection>

            <DocSection
                id={ANCHOR.safety}
                title={t.safety.title}
                description={t.safety.intro}
            >
                <DocSubsection
                    id={ANCHOR.safetyCompile}
                    title={t.safety.compileCheck.title}
                    description={t.safety.compileCheck.body}
                />

                <DocSubsection
                    id={ANCHOR.safetyTest}
                    title={t.safety.complianceTest.title}
                    description={t.safety.complianceTest.body}
                >
                    <ExpandableCode>
                        <CodeViewer code={COMPLIANCE_TEST_SNIPPET} language={`tsx`} fitContent />
                    </ExpandableCode>
                </DocSubsection>
            </DocSection>

            <DocSection
                id={ANCHOR.conventions}
                title={t.conventions.title}
                description={t.conventions.intro}
            >
                <DocSubsection
                    id={ANCHOR.conventionsNamespace}
                    title={t.conventions.namespacing.title}
                    description={t.conventions.namespacing.body}
                />
                <DocSubsection
                    id={ANCHOR.conventionsFlat}
                    title={t.conventions.flatKeys.title}
                    description={t.conventions.flatKeys.body}
                />
                <DocSubsection
                    id={ANCHOR.conventionsActions}
                    title={t.conventions.actionIds.title}
                    description={t.conventions.actionIds.body}
                />
                <DocSubsection
                    id={ANCHOR.conventionsSpread}
                    title={t.conventions.spreadBase.title}
                    description={t.conventions.spreadBase.body}
                />
            </DocSection>
        </DocPage>
    );
};

export default TranslationsGuide;
