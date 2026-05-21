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
import { sliderExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    range: `examples-range`,
    disabled: `examples-disabled`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { Slider } from "mows-components-react";

const [value, setValue] = useState<number[]>([50]);

<Slider value={value} onValueChange={setValue} max={100} step={1} />`;

const COMPOSITION_SNIPPET = `// Slider renders one thumb per entry in value / defaultValue. Pass a
// two-entry array to get a range slider; the second thumb cannot cross
// the first.

const [range, setRange] = useState<number[]>([20, 80]);
<Slider value={range} onValueChange={setRange} min={0} max={100} step={1} />

// Without any value / defaultValue prop the slider defaults to a single
// thumb at min (0 by default).
<Slider />`;

const PROPS: PropRow[] = [
    { name: `value`, type: `number[]`, default: `—`, description: `Controlled value(s). One thumb per array entry.` },
    { name: `defaultValue`, type: `number[]`, default: `—`, description: `Uncontrolled initial value.` },
    { name: `onValueChange`, type: `(value: number[]) => void`, default: `—`, description: `Fires while the user drags.` },
    { name: `onValueCommit`, type: `(value: number[]) => void`, default: `—`, description: `Fires once when the drag ends (pointer-up / key release).` },
    { name: `min`, type: `number`, default: `0`, description: `Minimum value. Applies to all thumbs.` },
    { name: `max`, type: `number`, default: `100`, description: `Maximum value. Applies to all thumbs.` },
    { name: `step`, type: `number`, default: `1`, description: `Smallest increment between values.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable the slider. Pointer + keyboard input ignored.` },
    { name: `orientation`, type: `"horizontal" | "vertical"`, default: `"horizontal"`, description: `Track orientation + arrow-key navigation direction.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the root.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<SliderDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.slider;
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
                { id: ANCHOR.range, label: doc.examples.range.title },
                { id: ANCHOR.disabled, label: doc.examples.disabled.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/slider.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.singleThumbDefault,
        testFile: TEST_FILE,
        testName: `renders a single thumb by default`,
        testLine: 7
    },
    {
        statement: statements.thumbsFromDefaultValue,
        testFile: TEST_FILE,
        testName: `renders one thumb per entry in defaultValue`,
        testLine: 13
    },
    {
        statement: statements.thumbsFromControlledValue,
        testFile: TEST_FILE,
        testName: `renders one thumb per entry in controlled value`,
        testLine: 18
    },
    {
        statement: statements.forwardsMinMax,
        testFile: TEST_FILE,
        testName: `forwards min / max to the underlying slider`,
        testLine: 23
    },
    {
        statement: statements.defaultRange,
        testFile: TEST_FILE,
        testName: `uses 0-100 as the default range`,
        testLine: 31
    },
    {
        statement: statements.disabledForwards,
        testFile: TEST_FILE,
        testName: `disabled forwards onto the thumbs`,
        testLine: 38
    },
    {
        statement: statements.classNameMerge,
        testFile: TEST_FILE,
        testName: `merges a custom className with the base classes`,
        testLine: 44
    }
];

export const SliderDocPage = () => {
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
                            example={sliderExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.range}
                        title={doc.examples.range.title}
                        description={doc.examples.range.description}
                    >
                        <ExampleCard
                            example={sliderExampleById(`range`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabled}
                        title={doc.examples.disabled.title}
                        description={doc.examples.disabled.description}
                    >
                        <ExampleCard
                            example={sliderExampleById(`disabled`)}
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
                <PropTable heading={`<Slider>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default SliderDocPage;
