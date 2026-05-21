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
import { inputExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    types: `examples-types`,
    disabled: `examples-disabled`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { Input, Label } from "mows-components-react";

<Label htmlFor="email">Email</Label>
<Input id="email" type="email" placeholder="you@example.com" />`;

const COMPOSITION_SNIPPET = `// Input is a thin styled wrapper over native <input>. Pair it with <Label>
// for accessible labelling (clicking the label focuses the input).

<Label htmlFor="username">Username</Label>
<Input id="username" autoComplete="username" />

// Controlled:
const [v, setV] = useState("");
<Input value={v} onChange={(e) => setV(e.target.value)} />`;

const PROPS: PropRow[] = [
    {
        name: `type`,
        type: `string`,
        default: `"text"`,
        description: `Standard HTML input type — text, email, password, number, url, search, file, …`
    },
    {
        name: `value`,
        type: `string | number`,
        default: `—`,
        description: `Controlled value. Pair with onChange.`
    },
    {
        name: `defaultValue`,
        type: `string | number`,
        default: `—`,
        description: `Uncontrolled initial value.`
    },
    {
        name: `onChange`,
        type: `(e: ChangeEvent<HTMLInputElement>) => void`,
        default: `—`,
        description: `Fires on every change.`
    },
    {
        name: `disabled`,
        type: `boolean`,
        default: `false`,
        description: `Disable the input.`
    },
    {
        name: `placeholder`,
        type: `string`,
        default: `—`,
        description: `Placeholder text shown when value is empty.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes merged after the base styling.`
    },
    {
        name: `...rest`,
        type: `InputHTMLAttributes<HTMLInputElement>`,
        default: `—`,
        description: `All other native input attributes forward (autoComplete, name, required, min/max, accept, …).`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<InputDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.input;
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
                { id: ANCHOR.types, label: doc.examples.types.title },
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

const TEST_FILE = `lib/components/ui/input.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersTextInput,
        testFile: TEST_FILE,
        testName: `renders a text input by default`,
        testLine: 9
    },
    {
        statement: statements.forwardsType,
        testFile: TEST_FILE,
        testName: `forwards the type attribute (e.g. password)`,
        testLine: 15
    },
    {
        statement: statements.firesOnChange,
        testFile: TEST_FILE,
        testName: `fires onChange when the user types`,
        testLine: 23
    },
    {
        statement: statements.fullyControllable,
        testFile: TEST_FILE,
        testName: `is fully controllable via value + onChange`,
        testLine: 31
    },
    {
        statement: statements.noInputWhenDisabled,
        testFile: TEST_FILE,
        testName: `does not accept input when disabled`,
        testLine: 43
    },
    {
        statement: statements.forwardsRef,
        testFile: TEST_FILE,
        testName: `forwards a ref to the underlying input element`,
        testLine: 52
    },
    {
        statement: statements.classNameMerge,
        testFile: TEST_FILE,
        testName: `merges a custom className with the base classes`,
        testLine: 58
    }
];

export const InputDocPage = () => {
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
                            example={inputExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.types}
                        title={doc.examples.types.title}
                        description={doc.examples.types.description}
                    >
                        <ExampleCard
                            example={inputExampleById(`types`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabled}
                        title={doc.examples.disabled.title}
                        description={doc.examples.disabled.description}
                    >
                        <ExampleCard
                            example={inputExampleById(`disabled`)}
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
                <PropTable heading={`<Input>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default InputDocPage;
