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
import { checkboxExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    indeterminate: `examples-indeterminate`,
    disabled: `examples-disabled`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { Checkbox } from "@mows/react-components";

const [checked, setChecked] = useState(false);

<Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />`;

const COMPOSITION_SNIPPET = `// Checkbox is tri-state via the Radix primitive. Pass "indeterminate" to
// render the dash glyph; the indicator switches to the check icon when
// checked. Wrap inside <Label> for a clickable label.

<Label className="flex items-center gap-2">
    <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
    Accept terms
</Label>

<Checkbox checked="indeterminate" />`;

const PROPS: PropRow[] = [
    {
        name: `checked`,
        type: `boolean | "indeterminate"`,
        default: `—`,
        description: `Controlled state. Pair with onCheckedChange.`
    },
    {
        name: `defaultChecked`,
        type: `boolean | "indeterminate"`,
        default: `—`,
        description: `Uncontrolled initial state.`
    },
    {
        name: `onCheckedChange`,
        type: `(checked: boolean | "indeterminate") => void`,
        default: `—`,
        description: `Fires when the user toggles or when the controlled state changes externally to indeterminate.`
    },
    {
        name: `disabled`,
        type: `boolean`,
        default: `false`,
        description: `Disable interaction.`
    },
    {
        name: `required`,
        type: `boolean`,
        default: `false`,
        description: `Forwarded onto the underlying input for native form validation.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes merged after the base styling.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<CheckboxDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.checkbox;
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
                { id: ANCHOR.indeterminate, label: doc.examples.indeterminate.title },
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

const TEST_FILE = `lib/components/ui/checkbox.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.defaultUnchecked,
        testFile: TEST_FILE,
        testName: `renders an unchecked checkbox by default`,
        testLine: 9
    },
    {
        statement: statements.indicatorWhenChecked,
        testFile: TEST_FILE,
        testName: `renders the check indicator only when checked`,
        testLine: 16
    },
    {
        statement: statements.defaultCheckedOnMount,
        testFile: TEST_FILE,
        testName: `reflects defaultChecked on first mount`,
        testLine: 23
    },
    {
        statement: statements.firesOnCheckedChange,
        testFile: TEST_FILE,
        testName: `fires onCheckedChange on click (uncontrolled)`,
        testLine: 31
    },
    {
        statement: statements.fullyControllable,
        testFile: TEST_FILE,
        testName: `is fully controllable via checked + onCheckedChange`,
        testLine: 39
    },
    {
        statement: statements.noToggleWhenDisabled,
        testFile: TEST_FILE,
        testName: `does not toggle when disabled`,
        testLine: 56
    },
    {
        statement: statements.indeterminateDataState,
        testFile: TEST_FILE,
        testName: `exposes the indeterminate state via data-state="indeterminate"`,
        testLine: 66
    }
];

export const CheckboxDocPage = () => {
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
                            example={checkboxExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.indeterminate}
                        title={doc.examples.indeterminate.title}
                        description={doc.examples.indeterminate.description}
                    >
                        <ExampleCard
                            example={checkboxExampleById(`indeterminate`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabled}
                        title={doc.examples.disabled.title}
                        description={doc.examples.disabled.description}
                    >
                        <ExampleCard
                            example={checkboxExampleById(`disabled`)}
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
                <PropTable heading={`<Checkbox>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default CheckboxDocPage;
