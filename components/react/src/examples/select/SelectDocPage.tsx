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
import { selectExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    disabledOption: `examples-disabled-option`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem
} from "mows-components-react";

const [value, setValue] = useState<string>();

<Select value={value} onValueChange={setValue}>
    <SelectTrigger><SelectValue placeholder="Pick…" /></SelectTrigger>
    <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
    </SelectContent>
</Select>`;

const COMPOSITION_SNIPPET = `// The trigger renders the active value via <SelectValue placeholder=…>.
// Each <SelectItem value> must be unique within the listbox. Mark
// individual items disabled with the disabled prop.

<Select defaultValue="apple">
    <SelectTrigger>
        <SelectValue placeholder="Pick a fruit" />
    </SelectTrigger>
    <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="cherry" disabled>Cherry (disabled)</SelectItem>
    </SelectContent>
</Select>`;

const ROOT_PROPS: PropRow[] = [
    { name: `value`, type: `string`, default: `—`, description: `Controlled value. Pair with onValueChange.` },
    { name: `defaultValue`, type: `string`, default: `—`, description: `Uncontrolled initial value.` },
    { name: `onValueChange`, type: `(value: string) => void`, default: `—`, description: `Fires when the user picks a different item.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable the trigger entirely.` },
    { name: `name`, type: `string`, default: `—`, description: `Forwards onto the hidden native form input for form submissions.` }
];

const ITEM_PROPS: PropRow[] = [
    { name: `value`, type: `string`, default: `—`, description: `Required. Matches the parent's value when this item is selected.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable this single item.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<SelectDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.select;
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
                { id: ANCHOR.disabledOption, label: doc.examples.disabledOption.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/select.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.placeholderWhenEmpty,
        testFile: TEST_FILE,
        testName: `renders a combobox trigger with placeholder text when empty`,
        testLine: 40
    },
    {
        statement: statements.reflectsDefaultValue,
        testFile: TEST_FILE,
        testName: `reflects defaultValue on the trigger`,
        testLine: 46
    },
    {
        statement: statements.fullyControllable,
        testFile: TEST_FILE,
        testName: `is fully controllable via value + onValueChange`,
        testLine: 57
    },
    {
        statement: statements.firesOnExternalValueChange,
        testFile: TEST_FILE,
        testName: `onValueChange fires when value changes from outside`,
        testLine: 87
    }
];

export const SelectDocPage = () => {
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
                        <ExampleCard
                            example={selectExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabledOption}
                        title={doc.examples.disabledOption.title}
                        description={doc.examples.disabledOption.description}
                    >
                        <ExampleCard
                            example={selectExampleById(`disabledOption`)}
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

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body} />

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
                <div className={`flex flex-col gap-8`}>
                    <PropTable heading={`<Select>`} rows={ROOT_PROPS} />
                    <PropTable heading={`<SelectItem>`} rows={ITEM_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default SelectDocPage;
