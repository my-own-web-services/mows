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
import { stepsExampleById } from "./index";

// Anchor ids deliberately omit a "steps-" prefix — the URL path
// (`/Steps#…`) already names the component, so duplicating it in every
// hash is noise. Keep anchors short and unique within the page.
const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    line: `examples-line`,
    endAlignment: `examples-end-alignment`,
    vertical: `examples-vertical`,
    loading: `examples-loading`,
    disabled: `examples-disabled`,
    icons: `examples-icons`,
    definedBehaviour: `defined-behaviour`,
    rtl: `rtl`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { Step, Steps } from "@mows/react-components";

const Wizard = () => {
    const [current, setCurrent] = useState(0);
    return (
        <Steps current={current}>
            <Step title="Account" description="Sign up" />
            <Step title="Profile" />
            <Step title="Done" />
        </Steps>
    );
};`;

const COMPOSITION_SNIPPET = `<Steps current={1} orientation="horizontal">
    <Step title="Account" description="Sign up" />
    <Step title="Profile" status="completed" />
    <Step title="Done" />
</Steps>`;

const STEPS_PROPS: PropRow[] = [
    {
        name: `current`,
        type: `number`,
        default: `(required)`,
        description: `Index of the active step.`
    },
    {
        name: `orientation`,
        type: `"horizontal" | "vertical"`,
        default: `"horizontal"`,
        description: `Layout direction.`
    },
    {
        name: `mode`,
        type: `"progress" | "selection"`,
        default: `"progress"`,
        description: `Whether earlier indices render as completed (progress) or only the active index is highlighted (selection).`
    },
    {
        name: `endAlignment`,
        type: `"side" | "center"`,
        default: `"side"`,
        description: `Horizontal-only. "side" anchors the first label to the left edge and the last label to the right edge (with half-flex columns so indicators stay evenly spaced). "center" centers every label, including first and last, under its indicator.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the <ol>.`
    }
];

const STEP_PROPS: PropRow[] = [
    {
        name: `title`,
        type: `ReactNode`,
        default: `(required)`,
        description: `Step label. Accepts any ReactNode — strings or icon + text.`
    },
    {
        name: `description`,
        type: `ReactNode`,
        default: `—`,
        description: `Optional secondary text under the title.`
    },
    {
        name: `status`,
        type: `"completed" | "current" | "upcoming"`,
        default: `(derived from index)`,
        description: `Override the index-derived status for this step.`
    },
    {
        name: `loading`,
        type: `boolean | number`,
        default: `false`,
        description: `Draws a loading ring around the indicator. true = indeterminate spinner; a number (0–100, clamped) = determinate progress ring filled to that percentage.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<StepsDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.steps;
};

type StepsStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: StepsStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.line, label: doc.examples.line.title },
                {
                    id: ANCHOR.endAlignment,
                    label: doc.examples.endAlignment.title
                },
                { id: ANCHOR.vertical, label: doc.examples.vertical.title },
                { id: ANCHOR.loading, label: doc.examples.loading.title },
                { id: ANCHOR.disabled, label: doc.examples.disabled.title },
                { id: ANCHOR.icons, label: doc.examples.icons.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/steps.test.tsx`;

const buildBehaviourEntries = (
    statements: StepsStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.derivesStatuses,
        testFile: TEST_FILE,
        testName: `derives completed / current / upcoming from current index`,
        testLine: 16
    },
    {
        statement: statements.ariaCurrent,
        testFile: TEST_FILE,
        testName: `marks the current step with aria-current`,
        testLine: 25
    },
    {
        statement: statements.rendersTitleDescription,
        testFile: TEST_FILE,
        testName: `renders titles and descriptions`,
        testLine: 33
    },
    {
        statement: statements.orientationAttr,
        testFile: TEST_FILE,
        testName: `reflects orientation on the list and respects it for layout`,
        testLine: 41
    },
    {
        statement: statements.statusOverride,
        testFile: TEST_FILE,
        testName: `allows per-step status override`,
        testLine: 58
    },
    {
        statement: statements.selectionNoCompleted,
        testFile: TEST_FILE,
        testName: `selection mode never marks earlier steps as completed`,
        testLine: 72
    },
    {
        statement: statements.selectionShowsNumbers,
        testFile: TEST_FILE,
        testName: `selection mode shows the step number on every step (no check icons)`,
        testLine: 88
    },
    {
        statement: statements.endAlignmentSide,
        testFile: TEST_FILE,
        testName: `endAlignment="side" gives first/last half flex weight to keep indicators evenly spaced`,
        testLine: 130
    },
    {
        statement: statements.endAlignmentCenter,
        testFile: TEST_FILE,
        testName: `endAlignment="center" centers every label and gives every step equal flex weight`,
        testLine: 152
    },
    {
        statement: statements.loadingIndeterminate,
        testFile: TEST_FILE,
        testName: `loading=true renders an indeterminate spinner ring around the indicator`,
        testLine: 200
    },
    {
        statement: statements.loadingDeterminate,
        testFile: TEST_FILE,
        testName: `loading={number} renders a determinate progress ring with aria-valuenow`,
        testLine: 219
    },
    {
        statement: statements.throwsOutsideSteps,
        testFile: TEST_FILE,
        testName: `throws when <Step> is rendered outside <Steps>`,
        testLine: 273
    }
];

export const StepsDocPage = () => {
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
                        id={ANCHOR.line}
                        title={doc.examples.line.title}
                        description={doc.examples.line.description}
                    >
                        <ExampleCard example={stepsExampleById(`horizontal`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.endAlignment}
                        title={doc.examples.endAlignment.title}
                        description={doc.examples.endAlignment.description}
                    >
                        <ExampleCard
                            example={stepsExampleById(`endAlignment`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.vertical}
                        title={doc.examples.vertical.title}
                        description={doc.examples.vertical.description}
                    >
                        <ExampleCard example={stepsExampleById(`vertical`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.loading}
                        title={doc.examples.loading.title}
                        description={doc.examples.loading.description}
                    >
                        <ExampleCard
                            example={stepsExampleById(`loading`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabled}
                        title={doc.examples.disabled.title}
                        description={doc.examples.disabled.description}
                    >
                        <ExampleCard example={stepsExampleById(`disabled`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.icons}
                        title={doc.examples.icons.title}
                        description={doc.examples.icons.description}
                    >
                        <ExampleCard example={stepsExampleById(`icons`)} hideHeader />
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
            >
                <ExampleCard example={stepsExampleById(`rtl`)} hideHeader />
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
                <PropTable heading={`<Steps>`} rows={STEPS_PROPS} />
                <PropTable heading={`<Step>`} rows={STEP_PROPS} className={`mt-4`} />
            </DocSection>
        </DocPage>
    );
};

export default StepsDocPage;
