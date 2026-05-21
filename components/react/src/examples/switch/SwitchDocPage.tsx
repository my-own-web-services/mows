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
import { switchExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    disabled: `examples-disabled`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { Switch } from "mows-components-react";

const [on, setOn] = useState(false);

<Switch checked={on} onCheckedChange={setOn} />`;

const COMPOSITION_SNIPPET = `// Switch is the Radix Switch primitive — boolean on/off only, no
// indeterminate state. Wrap inside <Label> so clicking the label toggles it.

<Label className="flex items-center gap-2">
    <Switch checked={on} onCheckedChange={setOn} />
    Enable feature
</Label>`;

const PROPS: PropRow[] = [
    {
        name: `checked`,
        type: `boolean`,
        default: `—`,
        description: `Controlled state. Pair with onCheckedChange.`
    },
    {
        name: `defaultChecked`,
        type: `boolean`,
        default: `—`,
        description: `Uncontrolled initial state.`
    },
    {
        name: `onCheckedChange`,
        type: `(checked: boolean) => void`,
        default: `—`,
        description: `Fires when the user toggles the switch.`
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
        description: `Extra classes merged onto the switch root.`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<SwitchDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.switch;
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

const TEST_FILE = `lib/components/ui/switch.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.defaultUnchecked,
        testFile: TEST_FILE,
        testName: `renders unchecked by default`,
        testLine: 9
    },
    {
        statement: statements.defaultCheckedOnMount,
        testFile: TEST_FILE,
        testName: `reflects defaultChecked on first mount`,
        testLine: 15
    },
    {
        statement: statements.firesOnCheckedChange,
        testFile: TEST_FILE,
        testName: `fires onCheckedChange on click (uncontrolled)`,
        testLine: 23
    },
    {
        statement: statements.fullyControllable,
        testFile: TEST_FILE,
        testName: `is fully controllable via checked + onCheckedChange`,
        testLine: 31
    },
    {
        statement: statements.noToggleWhenDisabled,
        testFile: TEST_FILE,
        testName: `does not toggle when disabled`,
        testLine: 48
    },
    {
        statement: statements.thumbTranslates,
        testFile: TEST_FILE,
        testName: `thumb translates only when checked`,
        testLine: 58
    }
];

export const SwitchDocPage = () => {
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
                            example={switchExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabled}
                        title={doc.examples.disabled.title}
                        description={doc.examples.disabled.description}
                    >
                        <ExampleCard
                            example={switchExampleById(`disabled`)}
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
                <PropTable heading={`<Switch>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default SwitchDocPage;
