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
import { numberInputExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    decimal: `examples-decimal`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { NumberInput } from "@mows/react-components";

const [v, setV] = useState<number | null>(null);

<NumberInput value={v} onChange={setV} min={0} max={64} step={1} />`;

const COMPOSITION_SNIPPET = `// integerOnly={true} (default) restricts the input to integers.
// Pass integerOnly={false} for decimal values, and use step={0.1} (etc.)
// to bump by a non-integer increment.

<NumberInput
    value={ram}
    onChange={setRam}
    integerOnly={false}
    step={0.1}
    min={0.1}
    max={10}
    placeholder="auto"
/>

// Hide the inline stepper buttons:
<NumberInput value={v} onChange={setV} hideStepper />`;

const PROPS: PropRow[] = [
    { name: `value`, type: `number | null`, default: `—`, description: `Required. Controlled value. null signals "empty".` },
    { name: `onChange`, type: `(value: number | null) => void`, default: `—`, description: `Required. Fires with the new value; clear / blur emits null / clamped value.` },
    { name: `min`, type: `number`, default: `—`, description: `Minimum value. Stepper and blur both clamp here.` },
    { name: `max`, type: `number`, default: `—`, description: `Maximum value. Stepper and blur both clamp here.` },
    { name: `step`, type: `number`, default: `1`, description: `Stepper increment.` },
    { name: `integerOnly`, type: `boolean`, default: `true`, description: `Restrict input to integers; sets the numeric inputMode + pattern accordingly.` },
    { name: `hideStepper`, type: `boolean`, default: `false`, description: `Hide the inline − / + buttons.` },
    { name: `placeholder`, type: `string`, default: `—`, description: `Placeholder text. Good place for "what gets used when empty".` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable input and stepper.` },
    { name: `ariaLabel`, type: `string`, default: `—`, description: `Accessible label when there is no visible <label htmlFor>.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<NumberInputDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.numberInput;
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
                { id: ANCHOR.decimal, label: doc.examples.decimal.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/input/numberInput/NumberInput.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersValue, testFile: TEST_FILE, testName: `renders an input with the controlled value`, testLine: 17 },
    { statement: statements.nullRendersEmpty, testFile: TEST_FILE, testName: `renders empty when value is null`, testLine: 22 },
    { statement: statements.clearEmitsNull, testFile: TEST_FILE, testName: `fires onChange with null when the user clears the field`, testLine: 27 },
    { statement: statements.bumpsByStepPlus, testFile: TEST_FILE, testName: `bumps by step when the + button is clicked`, testLine: 36 },
    { statement: statements.bumpsByStepMinus, testFile: TEST_FILE, testName: `bumps by -step when the − button is clicked`, testLine: 45 },
    { statement: statements.clampsToMin, testFile: TEST_FILE, testName: `clamps to min on −`, testLine: 54 },
    { statement: statements.clampsToMax, testFile: TEST_FILE, testName: `clamps to max on +`, testLine: 63 },
    { statement: statements.clampOnBlur, testFile: TEST_FILE, testName: `clamps an out-of-range typed value on blur`, testLine: 72 },
    { statement: statements.hideStepper, testFile: TEST_FILE, testName: `hideStepper drops the +/- buttons`, testLine: 96 }
];

export const NumberInputDocPage = () => {
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
                        <ExampleCard example={numberInputExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.decimal}
                        title={doc.examples.decimal.title}
                        description={doc.examples.decimal.description}
                    >
                        <ExampleCard example={numberInputExampleById(`decimal`)} hideHeader />
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
                <PropTable heading={`<NumberInput>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default NumberInputDocPage;
