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
import { buttonSelectExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    disabled: `examples-disabled`,
    disabledOption: `examples-disabled-option`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { ButtonSelect } from "@mows/react-components";

const [selected, setSelected] = useState("grid");

<ButtonSelect
    selectedId={selected}
    onSelectionChange={setSelected}
    options={[
        { id: "grid",  icon: "▦", label: "Grid" },
        { id: "list",  icon: "≣", label: "List" },
        { id: "table", icon: "▤", label: "Table" }
    ]}
/>`;

const COMPOSITION_SNIPPET = `// Disable the whole group or a single option.
<ButtonSelect
    disabled
    selectedId={selected}
    onSelectionChange={setSelected}
    options={options}
/>

<ButtonSelect
    selectedId={selected}
    onSelectionChange={setSelected}
    options={[
        { id: "grid",  icon: "▦", label: "Grid" },
        { id: "list",  icon: "≣", label: "List", disabled: true },
        { id: "table", icon: "▤", label: "Table" }
    ]}
/>`;

const SELECT_PROPS: PropRow[] = [
    {
        name: `options`,
        type: `readonly ButtonSelectOption[]`,
        default: `—`,
        description: `Required. Ordered list of { id, icon, label?, disabled? } entries.`
    },
    {
        name: `selectedId`,
        type: `string`,
        default: `—`,
        description: `The id of the currently-selected option. Used to render the accent background and the aria-pressed attribute.`
    },
    {
        name: `onSelectionChange`,
        type: `(id: string) => void`,
        default: `—`,
        description: `Required. Called with the clicked option's id. Not called for disabled options or when the whole group is disabled.`
    },
    {
        name: `disabled`,
        type: `boolean`,
        default: `false`,
        description: `Disables every option in the group.`
    },
    {
        name: `size`,
        type: `"sm" | "lg" | "icon-sm" | "icon" | "icon-lg" | "default"`,
        default: `"sm"`,
        description: `Button size forwarded to each <Button>.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the outer group wrapper.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Inline style on the outer group wrapper.`
    }
];

const OPTION_PROPS: PropRow[] = [
    { name: `id`, type: `string`, default: `—`, description: `Required. Stable identifier matched against selectedId.` },
    { name: `icon`, type: `ReactNode`, default: `—`, description: `Required. The visual rendered inside the button.` },
    { name: `label`, type: `string`, default: `—`, description: `Surfaces as the native button title (tooltip).` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disables this single option without affecting the rest of the group.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<ButtonSelectDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.buttonSelect;
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
                { id: ANCHOR.disabled, label: doc.examples.disabled.title },
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

const TEST_FILE = `lib/components/input/buttonSelect/ButtonSelect.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersAllOptions,
        testFile: TEST_FILE,
        testName: `renders all options`,
        testLine: 17
    },
    {
        statement: statements.selectedDefaultVariant,
        testFile: TEST_FILE,
        testName: `shows selected option with default variant`,
        testLine: 32
    },
    {
        statement: statements.nonSelectedOutline,
        testFile: TEST_FILE,
        testName: `shows non-selected options with outline variant`,
        testLine: 46
    },
    {
        statement: statements.clickFiresChange,
        testFile: TEST_FILE,
        testName: `calls onSelectionChange when option is clicked`,
        testLine: 60
    },
    {
        statement: statements.disabledOptionNoChange,
        testFile: TEST_FILE,
        testName: `does not call onSelectionChange when disabled option is clicked`,
        testLine: 76
    },
    {
        statement: statements.groupDisabledNoChange,
        testFile: TEST_FILE,
        testName: `does not call onSelectionChange when component is disabled`,
        testLine: 92
    },
    {
        statement: statements.forwardsClassName,
        testFile: TEST_FILE,
        testName: `applies custom className`,
        testLine: 109
    },
    {
        statement: statements.forwardsStyle,
        testFile: TEST_FILE,
        testName: `applies custom styles`,
        testLine: 124
    },
    {
        statement: statements.accessibility,
        testFile: TEST_FILE,
        testName: `has proper accessibility attributes`,
        testLine: 140
    }
];

export const ButtonSelectDocPage = () => {
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
                            example={buttonSelectExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabled}
                        title={doc.examples.disabled.title}
                        description={doc.examples.disabled.description}
                    >
                        <ExampleCard
                            example={buttonSelectExampleById(`disabled`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabledOption}
                        title={doc.examples.disabledOption.title}
                        description={doc.examples.disabledOption.description}
                    >
                        <ExampleCard
                            example={buttonSelectExampleById(`disabledOption`)}
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
                    <PropTable heading={`<ButtonSelect>`} rows={SELECT_PROPS} />
                    <PropTable heading={`ButtonSelectOption`} rows={OPTION_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default ButtonSelectDocPage;
