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
import { durationExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    responsive: `examples-responsive`,
    variants: `examples-variants`,
    granularity: `examples-granularity`,
    ranges: `examples-ranges`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { Duration } from "@my-own-web-services/react-components";

<Duration seconds={60 * 60 + 10 * 60} />`;

const COMPOSITION_SNIPPET = `// The component is display: inline-block and overflow-hidden.
// The parent decides how wide the slot is — the component picks
// the longest variant that fits.

<div style={{ width: 80 }}>
    <Duration seconds={60 * 60 + 10 * 60} />
</div>

// Force a specific verbosity inside fixed chips or tables:
<Duration seconds={60 * 60 + 10 * 60} variant="medium" />`;

const PROPS: PropRow[] = [
    { name: `seconds`, type: `number`, default: `—`, description: `Length of the duration in seconds. Floored to whole seconds; negative or non-finite values are treated as zero and render as <1 [minUnit].` },
    { name: `variant`, type: `"long" | "medium" | "short"`, default: `auto`, description: `Force a specific verbosity instead of letting the component pick from container width.` },
    { name: `minUnit`, type: `"s" | "min" | "h" | "d"`, default: `"s"`, description: `Coarsest precision to surface. Sub-minUnit parts are dropped entirely; sub-minUnit inputs render as "<1 [unit]".` },
    { name: `ariaLabel`, type: `string`, default: `long-variant text`, description: `Screen-reader label. Defaults to the verbose ("long") string so the spoken form stays readable even when the visible label collapses.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer span.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer span.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext)
        throw new Error(`<DurationDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.duration;
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
                { id: ANCHOR.responsive, label: doc.examples.responsive.title },
                { id: ANCHOR.variants, label: doc.examples.variants.title },
                { id: ANCHOR.granularity, label: doc.examples.granularity.title },
                { id: ANCHOR.ranges, label: doc.examples.ranges.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/dateTime/duration/Duration.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.splitsToTwoParts,
        testFile: TEST_FILE,
        testName: `anchors to hours and surfaces remaining minutes`,
        testLine: 32
    },
    {
        statement: statements.dropsZeroSecondary,
        testFile: TEST_FILE,
        testName: `omits zero secondary parts so exact units render as a single part`,
        testLine: 46
    },
    {
        statement: statements.neverZeroSeconds,
        testFile: TEST_FILE,
        testName: `renders an exact zero duration as <1 s (never 0 s)`,
        testLine: 237
    },
    {
        statement: statements.minUnitFloors,
        testFile: TEST_FILE,
        testName: `floors to minUnit so a 5 min 30 s duration shows 5 min`,
        testLine: 242
    },
    {
        statement: statements.minUnitLessThan,
        testFile: TEST_FILE,
        testName: `renders sub-minUnit input as <1 [minUnit]`,
        testLine: 247
    },
    {
        statement: statements.subMinuteSecondsOnly,
        testFile: TEST_FILE,
        testName: `returns a single seconds part for sub-minute durations`,
        testLine: 17
    },
    {
        statement: statements.longVariant,
        testFile: TEST_FILE,
        testName: `renders 1h 10min as long variant verbatim`,
        testLine: 97
    },
    {
        statement: statements.mediumVariant,
        testFile: TEST_FILE,
        testName: `renders 1h 10min as medium variant with min collapsed to m`,
        testLine: 101
    },
    {
        statement: statements.shortVariant,
        testFile: TEST_FILE,
        testName: `renders 1h 10min as short variant dropping the trailing unit label`,
        testLine: 105
    },
    {
        statement: statements.forceVariant,
        testFile: TEST_FILE,
        testName: `forces the visible label to the requested variant when provided`,
        testLine: 164
    },
    {
        statement: statements.ariaLabelVerbose,
        testFile: TEST_FILE,
        testName: `exposes the verbose form as aria-label even when a shorter visible variant is forced`,
        testLine: 182
    },
    {
        statement: statements.clampsNegatives,
        testFile: TEST_FILE,
        testName: `clamps negative inputs and renders them as <1 s instead of 0 s`,
        testLine: 232
    }
];

export const DurationDocPage = () => {
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
                        <ExampleCard example={durationExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.responsive}
                        title={doc.examples.responsive.title}
                        description={doc.examples.responsive.description}
                    >
                        <ExampleCard example={durationExampleById(`responsive`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.variants}
                        title={doc.examples.variants.title}
                        description={doc.examples.variants.description}
                    >
                        <ExampleCard example={durationExampleById(`variants`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.granularity}
                        title={doc.examples.granularity.title}
                        description={doc.examples.granularity.description}
                    >
                        <ExampleCard example={durationExampleById(`granularity`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.ranges}
                        title={doc.examples.ranges.title}
                        description={doc.examples.ranges.description}
                    >
                        <ExampleCard example={durationExampleById(`ranges`)} hideHeader />
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

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body}>
                <div dir={`rtl`}>
                    <ExampleCard example={durationExampleById(`default`)} hideHeader />
                </div>
            </DocSection>

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
                <PropTable heading={`<Duration>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default DurationDocPage;
