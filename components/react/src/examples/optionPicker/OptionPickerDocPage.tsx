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
import { optionPickerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { OptionPicker, type OptionItem } from "mows-components-react";

const [opts, setOpts] = useState<OptionItem[]>([
    { id: "compact", label: "Compact rows", enabled: true },
    { id: "wrap",    label: "Wrap text",    enabled: false }
]);

<OptionPicker
    options={opts}
    onOptionChange={(id, enabled) =>
        setOpts((prev) => prev.map((o) => (o.id === id ? { ...o, enabled } : o)))
    }
    showCount
/>`;

const COMPOSITION_SNIPPET = `// OptionPicker is a multi-select dropdown built on DropdownMenuCheckboxItem.
// Each click toggles one option but keeps the menu open (preventDefault on
// the underlying onSelect).

<OptionPicker
    options={columns}
    onOptionChange={toggleColumn}
    triggerComponent={<><Columns3 /> Columns</>}
    triggerVariant="outline"
    header="Visible columns"
/>`;

const PROPS: PropRow[] = [
    { name: `options`, type: `readonly OptionItem[]`, default: `—`, description: `Required. Ordered list of { id, label, enabled }.` },
    { name: `onOptionChange`, type: `(id: string, enabled: boolean) => void`, default: `—`, description: `Required. Fires whenever an option is toggled.` },
    { name: `triggerComponent`, type: `ReactNode`, default: `"Options"`, description: `Custom trigger label / content.` },
    { name: `triggerVariant`, type: `ButtonVariant`, default: `"iconStandalone"`, description: `Trigger button variant.` },
    { name: `triggerSize`, type: `ButtonSize`, default: `"sm"`, description: `Trigger button size.` },
    { name: `showCount`, type: `boolean`, default: `true`, description: `Show "(enabled/total)" next to the trigger label.` },
    { name: `header`, type: `ReactNode`, default: `—`, description: `Optional label at the top of the dropdown.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable the trigger.` }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) throw new Error(`<OptionPickerDocPage> must be rendered inside <MowsProvider>`);
    return ctx.t.example.examples.optionPicker;
};

type Strings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: Strings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [{ id: ANCHOR.default, label: doc.examples.default.title }]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/input/optionPicker/OptionPicker.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersLabel, testFile: TEST_FILE, testName: `renders the trigger label`, testLine: 15 },
    { statement: statements.showsCountByDefault, testFile: TEST_FILE, testName: `renders the enabled/total count on the trigger by default`, testLine: 20 },
    { statement: statements.hidesCountWhenFalse, testFile: TEST_FILE, testName: `omits the count when showCount={false}`, testLine: 25 },
    { statement: statements.menuItemsAfterOpen, testFile: TEST_FILE, testName: `renders one menuitemcheckbox per option after opening`, testLine: 30 },
    { statement: statements.firesOnToggle, testFile: TEST_FILE, testName: `fires onOptionChange when a menu item is toggled`, testLine: 38 },
    { statement: statements.staysOpenOnToggle, testFile: TEST_FILE, testName: `stays open after toggling an option (preventDefault on select)`, testLine: 47 },
    { statement: statements.rendersHeader, testFile: TEST_FILE, testName: `renders the optional header label`, testLine: 67 },
    { statement: statements.disabledForwards, testFile: TEST_FILE, testName: `disabled trigger forwards the disabled attribute and ignores clicks`, testLine: 80 }
];

export const OptionPickerDocPage = () => {
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
                        <ExampleCard example={optionPickerExampleById(`default`)} hideHeader />
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
                <PropTable heading={`<OptionPicker>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default OptionPickerDocPage;
