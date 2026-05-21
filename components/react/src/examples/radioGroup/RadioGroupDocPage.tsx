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
import { radioGroupExampleById } from "./index";

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
    RadioGroup,
    RadioGroupItem,
    Label
} from "mows-components-react";

const [value, setValue] = useState("apple");

<RadioGroup value={value} onValueChange={setValue}>
    <Label className="flex items-center gap-2">
        <RadioGroupItem value="apple" /> Apple
    </Label>
    <Label className="flex items-center gap-2">
        <RadioGroupItem value="banana" /> Banana
    </Label>
</RadioGroup>`;

const COMPOSITION_SNIPPET = `// Each <RadioGroupItem value> must be unique within the group. Wrap each
// item inside a <Label> for a clickable label. Mark individual items
// disabled with the disabled prop.

<RadioGroup defaultValue="apple">
    <RadioGroupItem value="apple" /> Apple
    <RadioGroupItem value="banana" /> Banana
    <RadioGroupItem value="cherry" disabled /> Cherry
</RadioGroup>`;

const GROUP_PROPS: PropRow[] = [
    { name: `value`, type: `string`, default: `—`, description: `Controlled value. Pair with onValueChange.` },
    { name: `defaultValue`, type: `string`, default: `—`, description: `Uncontrolled initial value.` },
    { name: `onValueChange`, type: `(value: string) => void`, default: `—`, description: `Fires when the user picks a different item.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable every item in the group.` },
    { name: `orientation`, type: `"horizontal" | "vertical"`, default: `"vertical"`, description: `Layout + keyboard navigation orientation.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the group container.` }
];

const ITEM_PROPS: PropRow[] = [
    { name: `value`, type: `string`, default: `—`, description: `Required. Matches the parent's value when this item is selected.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable this single item.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the item.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<RadioGroupDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.radioGroup;
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

const TEST_FILE = `lib/components/ui/radio-group.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersRadios,
        testFile: TEST_FILE,
        testName: `renders each item as a radio`,
        testLine: 25
    },
    {
        statement: statements.roleRadiogroup,
        testFile: TEST_FILE,
        testName: `uses role="radiogroup" on the wrapper`,
        testLine: 31
    },
    {
        statement: statements.defaultValueOnMount,
        testFile: TEST_FILE,
        testName: `reflects defaultValue on first mount`,
        testLine: 36
    },
    {
        statement: statements.firesOnValueChange,
        testFile: TEST_FILE,
        testName: `fires onValueChange when an item is clicked`,
        testLine: 44
    },
    {
        statement: statements.fullyControllable,
        testFile: TEST_FILE,
        testName: `is fully controllable via value + onValueChange`,
        testLine: 52
    },
    {
        statement: statements.disabledNoSwitch,
        testFile: TEST_FILE,
        testName: `does not switch to a disabled item`,
        testLine: 72
    }
];

export const RadioGroupDocPage = () => {
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
                            example={radioGroupExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabledOption}
                        title={doc.examples.disabledOption.title}
                        description={doc.examples.disabledOption.description}
                    >
                        <ExampleCard
                            example={radioGroupExampleById(`disabledOption`)}
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
                <div className={`flex flex-col gap-8`}>
                    <PropTable heading={`<RadioGroup>`} rows={GROUP_PROPS} />
                    <PropTable heading={`<RadioGroupItem>`} rows={ITEM_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default RadioGroupDocPage;
