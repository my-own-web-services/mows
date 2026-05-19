import * as React from "react";
import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../../lib/components/code/expandableCode/ExpandableCode";
import { type PageIndexItem } from "../../../lib/components/navigation/pageIndex/PageIndex";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { CommandBlock } from "../harness/CommandBlock";
import { ExampleCard } from "../harness/ExampleCard";
import {
    BehaviourList,
    type BehaviourEntry,
    DocPage,
    DocSection,
    DocSubsection,
    InstallationTabs,
    ManualStep,
    ManualSteps,
    PropTable,
    type PropRow
} from "../harness/docPage";
import { pageIndexExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    nested: `examples-nested`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { PageIndex } from "mows-components-react";

const items = [
    { id: "intro",      label: "Introduction" },
    { id: "install",    label: "Installation" },
    { id: "api",        label: "API" }
];

<PageIndex items={items} />`;

const COMPOSITION_SNIPPET = `<div className="flex gap-6">
    <div className="flex flex-1 flex-col gap-6">
        <section id="intro">…</section>
        <section id="install">…</section>
        <section id="api">…</section>
    </div>
    <aside className="sticky top-4 w-44 self-start">
        <PageIndex items={items} />
    </aside>
</div>`;

const PAGE_INDEX_PROPS: PropRow[] = [
    {
        name: `items`,
        type: `ReadonlyArray<PageIndexItem>`,
        default: `(required)`,
        description: `Each item is { id, label, children? }. id must match a DOM element's id; children renders an indented nested list.`
    },
    {
        name: `scrollOffset`,
        type: `number`,
        default: `80`,
        description: `Pixels of headroom above the active section (also used by scrollToSection).`
    },
    {
        name: `heading`,
        type: `ReactNode | null`,
        default: `t.pageIndex.heading`,
        description: `Label shown above the list. Pass null to hide it entirely.`
    },
    {
        name: `ariaLabel`,
        type: `string`,
        default: `t.pageIndex.ariaLabel`,
        description: `Accessible name on the <nav>.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the <nav>.`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<PageIndexDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.pageIndex;
};

type PageIndexStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: PageIndexStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.default, label: doc.examples.default.title },
                { id: ANCHOR.nested, label: doc.examples.nested.title }
            ]
        },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/navigation/pageIndex/PageIndex.test.tsx`;

const buildBehaviourEntries = (
    statements: PageIndexStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.pushesHashOnClick,
        testFile: TEST_FILE,
        testName: `scrolls to the section and writes the URL hash on click`,
        testLine: 41
    },
    {
        statement: statements.smoothOnClick,
        testFile: TEST_FILE,
        testName: `animates the scroll on click ("smooth")`,
        testLine: 49
    },
    {
        statement: statements.instantOnLoad,
        testFile: TEST_FILE,
        testName: `jumps instantly (no animation) when a hash is present at mount`,
        testLine: 58
    },
    {
        statement: statements.immediateActiveOnClick,
        testFile: TEST_FILE,
        testName: `marks the clicked entry active immediately, even when the page does not actually scroll`,
        testLine: 71
    },
    {
        statement: statements.holdsActiveDuringScroll,
        testFile: TEST_FILE,
        testName: `holds the clicked entry active while scroll events fire mid-animation`,
        testLine: 87
    },
    {
        statement: statements.nestedRenders,
        testFile: TEST_FILE,
        testName: `renders a link for every leaf and parent`,
        testLine: 190
    },
    {
        statement: statements.nestedScrollsToChild,
        testFile: TEST_FILE,
        testName: `scrolls to nested children when clicked`,
        testLine: 198
    },
    {
        statement: statements.emptyRendersNothing,
        testFile: TEST_FILE,
        testName: `renders nothing when items is empty`,
        testLine: 120
    },
    {
        statement: statements.missingIdSkipsHash,
        testFile: TEST_FILE,
        testName: `skips the hash write when the target id is missing`,
        testLine: 125
    },
    {
        statement: statements.translationFallback,
        testFile: TEST_FILE,
        testName: `falls back to English when no MowsContext is mounted`,
        testLine: 136
    }
];

export const PageIndexDocPage = () => {
    const t = useDocStrings();
    const doc = t.doc;
    const indexItems = React.useMemo(() => buildIndexItems(t), [t]);
    const behaviourEntries = React.useMemo(
        () => buildBehaviourEntries(doc.definedBehaviour.statements),
        [doc.definedBehaviour.statements]
    );

    return (
        <DocPage indexItems={indexItems}>
            <DocSection id={ANCHOR.installation} title={doc.installation.title}>
                <InstallationTabs
                    commandTabLabel={doc.installation.commandTab}
                    manualTabLabel={doc.installation.manualTab}
                    command={PACKAGE_INSTALL}
                    manual={
                        <ManualSteps>
                            <ManualStep n={1}>
                                <p className={`text-sm`}>{doc.installation.manualStep1}</p>
                                <CommandBlock command={PACKAGE_INSTALL} />
                            </ManualStep>
                            <ManualStep n={2}>
                                <p className={`text-sm`}>{doc.installation.manualStep2}</p>
                                <ExpandableCode>
                                    <CodeViewer
                                        code={USAGE_SNIPPET}
                                        language={`tsx`}
                                        fitContent
                                    />
                                </ExpandableCode>
                            </ManualStep>
                            <ManualStep n={3} isLast>
                                <p className={`text-sm`}>{doc.installation.manualStep3}</p>
                            </ManualStep>
                        </ManualSteps>
                    }
                />
            </DocSection>

            <DocSection
                id={ANCHOR.usage}
                title={doc.usage.title}
                description={doc.usage.body}
            >
                <ExpandableCode>
                    <CodeViewer code={USAGE_SNIPPET} language={`tsx`} fitContent />
                </ExpandableCode>
            </DocSection>

            <DocSection
                id={ANCHOR.composition}
                title={doc.composition.title}
                description={doc.composition.body}
            >
                <ExpandableCode>
                    <CodeViewer code={COMPOSITION_SNIPPET} language={`tsx`} fitContent />
                </ExpandableCode>
            </DocSection>

            <DocSection id={ANCHOR.examples} title={doc.examples.title}>
                <div className={`flex flex-col gap-10`}>
                    <DocSubsection
                        id={ANCHOR.default}
                        title={doc.examples.default.title}
                        description={doc.examples.default.description}
                    >
                        <ExampleCard example={pageIndexExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.nested}
                        title={doc.examples.nested.title}
                        description={doc.examples.nested.description}
                    >
                        <ExampleCard example={pageIndexExampleById(`nested`)} hideHeader />
                    </DocSubsection>
                </div>
            </DocSection>

            <DocSection
                id={ANCHOR.rtl}
                title={doc.rtl.title}
                description={doc.rtl.body}
            />

            <DocSection
                id={ANCHOR.definedBehaviour}
                title={doc.definedBehaviour.title}
                description={doc.definedBehaviour.intro}
            >
                <BehaviourList
                    entries={behaviourEntries}
                    verifiedByLabel={doc.definedBehaviour.verifiedBy}
                />
            </DocSection>

            <DocSection
                id={ANCHOR.apiReference}
                title={doc.apiReference.title}
                description={doc.apiReference.intro}
            >
                <PropTable heading={`<PageIndex>`} rows={PAGE_INDEX_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default PageIndexDocPage;
