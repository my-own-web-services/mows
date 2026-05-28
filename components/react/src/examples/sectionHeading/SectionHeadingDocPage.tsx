import * as React from "react";
import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../../lib/components/code/expandableCode/ExpandableCode";
import { type PageIndexItem } from "../../../lib/components/navigation/pageIndex/PageIndex";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { CommandBlock } from "../harness/docPage/CommandBlock";
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
import { sectionHeadingExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    levels: `examples-levels`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { SectionHeading } from "@my-own-web-services/react-components";

<SectionHeading id="installation" level={3}>
    Installation
</SectionHeading>`;

const COMPOSITION_SNIPPET = `// Pair <SectionHeading> with anchored sections that share its id, so
// clicking the heading scrolls to itself and writes the URL hash.

<section id="installation">
    <SectionHeading id="installation" level={3}>
        Installation
    </SectionHeading>
    {/* …body… */}
</section>`;

const SECTION_HEADING_PROPS: PropRow[] = [
    {
        name: `id`,
        type: `string`,
        default: `(required)`,
        description: `DOM id placed on the rendered <hN>. Becomes the URL hash on click.`
    },
    {
        name: `level`,
        type: `1 | 2 | 3 | 4 | 5 | 6`,
        default: `2`,
        description: `Heading level — renders as h1 … h6.`
    },
    {
        name: `scrollOffset`,
        type: `number`,
        default: `80`,
        description: `Pixels of headroom above the heading when click-scrolling to it.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the heading element.`
    },
    {
        name: `linkClassName`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the inner anchor element.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<SectionHeadingDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.sectionHeading;
};

type SectionHeadingStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: SectionHeadingStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.default, label: doc.examples.default.title },
                { id: ANCHOR.levels, label: doc.examples.levels.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/navigation/sectionHeading/SectionHeading.test.tsx`;

const buildBehaviourEntries = (
    statements: SectionHeadingStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersLevel,
        testFile: TEST_FILE,
        testName: `renders the requested heading level with the given id`,
        testLine: 17
    },
    {
        statement: statements.defaultsToH2,
        testFile: TEST_FILE,
        testName: `defaults to h2`,
        testLine: 27
    },
    {
        statement: statements.anchorHref,
        testFile: TEST_FILE,
        testName: `wraps the text in an anchor with the matching href`,
        testLine: 32
    },
    {
        statement: statements.pushesHash,
        testFile: TEST_FILE,
        testName: `pushes the id to the URL on click`,
        testLine: 38
    },
    {
        statement: statements.noDuplicateHistory,
        testFile: TEST_FILE,
        testName: `does not push a duplicate history entry when the hash is already current`,
        testLine: 45
    },
    {
        statement: statements.preventsDefaultScroll,
        testFile: TEST_FILE,
        testName: `prevents the browser's default scroll so we can use scrollToSection`,
        testLine: 55
    },
    {
        statement: statements.hoverUnderlineText,
        testFile: TEST_FILE,
        testName: `underlines the heading text on hover`,
        testLine: 65
    },
    {
        statement: statements.dimMarker,
        testFile: TEST_FILE,
        testName: `only the title text is clickable — the "#" marker sits outside the anchor`,
        testLine: 74
    }
];

export const SectionHeadingDocPage = () => {
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
                            <ManualStep stepNumber={1}>
                                <p className={`text-sm`}>{doc.installation.manualStep1}</p>
                                <CommandBlock command={PACKAGE_INSTALL} />
                            </ManualStep>
                            <ManualStep stepNumber={2}>
                                <p className={`text-sm`}>{doc.installation.manualStep2}</p>
                                <ExpandableCode>
                                    <CodeViewer
                                        code={USAGE_SNIPPET}
                                        language={`tsx`}
                                        fitContent
                                    />
                                </ExpandableCode>
                            </ManualStep>
                            <ManualStep stepNumber={3} isLast>
                                <p className={`text-sm`}>{doc.installation.manualStep3}</p>
                            </ManualStep>
                        </ManualSteps>
                    }
                />
            </DocSection>

            <DocSection id={ANCHOR.examples} title={doc.examples.title}>
                <div className={`flex flex-col gap-10`}>
                    <DocSubsection
                        id={ANCHOR.default}
                        title={doc.examples.default.title}
                        description={doc.examples.default.description}
                    >
                        <ExampleCard
                            example={sectionHeadingExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.levels}
                        title={doc.examples.levels.title}
                        description={doc.examples.levels.description}
                    >
                        <ExampleCard
                            example={sectionHeadingExampleById(`levels`)}
                            hideHeader
                        />
                    </DocSubsection>
                </div>
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
                <PropTable heading={`<SectionHeading>`} rows={SECTION_HEADING_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default SectionHeadingDocPage;
