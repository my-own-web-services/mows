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
import { expandableCodeExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    short: `examples-short`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { ExpandableCode, CodeViewer } from "@my-own-web-services/react-components";

<ExpandableCode>
    <CodeViewer code={src} language="tsx" fitContent />
</ExpandableCode>`;

const COMPOSITION_SNIPPET = `// Pair with <CodeViewer fitContent /> so the inner CodeViewer reports its
// natural height. ExpandableCode then clips the wrapper to collapsedHeight
// while collapsed and reveals the full snippet via an Expand button.

<ExpandableCode collapsedHeight={400}>
    <CodeViewer code={src} language="tsx" fitContent />
</ExpandableCode>

// Skip the affordance entirely when the content fits — no button is rendered.`;

const PROPS: PropRow[] = [
    {
        name: `collapsedHeight`,
        type: `number`,
        default: `280`,
        description: `Height in pixels shown when collapsed. Content shorter than this renders without any affordance.`
    },
    {
        name: `defaultExpanded`,
        type: `boolean`,
        default: `false`,
        description: `Initial expanded state.`
    },
    {
        name: `expandLabel`,
        type: `string`,
        default: `from translation`,
        description: `Override the translated "Expand" label.`
    },
    {
        name: `collapseLabel`,
        type: `string`,
        default: `from translation`,
        description: `Override the translated "Collapse" label.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the outer wrapper.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<ExpandableCodeDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.expandableCode;
};

type Strings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: Strings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.default, label: doc.examples.default.title },
                { id: ANCHOR.short, label: doc.examples.short.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/code/expandableCode/ExpandableCode.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersChildren, testFile: TEST_FILE, testName: `renders the children verbatim`, testLine: 38 },
    { statement: statements.noButtonWhenFits, testFile: TEST_FILE, testName: `hides the Expand button when content fits within collapsedHeight`, testLine: 50 },
    { statement: statements.buttonWhenOverflow, testFile: TEST_FILE, testName: `shows the Expand button when content exceeds collapsedHeight`, testLine: 62 },
    { statement: statements.togglesLabels, testFile: TEST_FILE, testName: `toggles between Expand and Collapse labels`, testLine: 76 },
    { statement: statements.defaultExpanded, testFile: TEST_FILE, testName: `honours defaultExpanded`, testLine: 93 },
    { statement: statements.labelOverrides, testFile: TEST_FILE, testName: `honours expandLabel / collapseLabel overrides`, testLine: 106 }
];

export const ExpandableCodeDocPage = () => {
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
                                    <CodeViewer code={USAGE_SNIPPET} language={`tsx`} fitContent />
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
                        <ExampleCard example={expandableCodeExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.short}
                        title={doc.examples.short.title}
                        description={doc.examples.short.description}
                    >
                        <ExampleCard example={expandableCodeExampleById(`short`)} hideHeader />
                    </DocSubsection>
                </div>
            </DocSection>

            <DocSection id={ANCHOR.usage} title={doc.usage.title} description={doc.usage.body}>
                <ExpandableCode>
                    <CodeViewer code={USAGE_SNIPPET} language={`tsx`} fitContent />
                </ExpandableCode>
            </DocSection>

            <DocSection id={ANCHOR.composition} title={doc.composition.title} description={doc.composition.body}>
                <ExpandableCode>
                    <CodeViewer code={COMPOSITION_SNIPPET} language={`tsx`} fitContent />
                </ExpandableCode>
            </DocSection>

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body} />

            <DocSection
                id={ANCHOR.definedBehaviour}
                title={doc.definedBehaviour.title}
                description={doc.definedBehaviour.intro}
            >
                <BehaviourList entries={behaviourEntries} verifiedByLabel={doc.definedBehaviour.verifiedBy} />
            </DocSection>

            <DocSection id={ANCHOR.apiReference} title={doc.apiReference.title} description={doc.apiReference.intro}>
                <PropTable heading={`<ExpandableCode>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default ExpandableCodeDocPage;
