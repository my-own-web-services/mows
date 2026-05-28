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
import { textareaExampleById } from "./index";

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

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { Textarea } from "@my-own-web-services/react-components";

<Textarea placeholder="Write something longer…" />`;

const COMPOSITION_SNIPPET = `// Textarea is a thin styled wrapper over native <textarea>. The default
// min-height is 60px; combine with a className like h-32 or rows={6} for a
// larger surface.

const [v, setV] = useState("");
<Textarea value={v} onChange={(e) => setV(e.target.value)} rows={6} />`;

const PROPS: PropRow[] = [
    {
        name: `value`,
        type: `string`,
        default: `—`,
        description: `Controlled value. Pair with onChange.`
    },
    {
        name: `defaultValue`,
        type: `string`,
        default: `—`,
        description: `Uncontrolled initial value.`
    },
    {
        name: `onChange`,
        type: `(e: ChangeEvent<HTMLTextAreaElement>) => void`,
        default: `—`,
        description: `Fires on every change.`
    },
    {
        name: `rows`,
        type: `number`,
        default: `—`,
        description: `Standard native rows attribute. The min-height tailwind class is the floor — rows can grow the textarea further.`
    },
    {
        name: `disabled`,
        type: `boolean`,
        default: `false`,
        description: `Disable the textarea.`
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
        type: `TextareaHTMLAttributes<HTMLTextAreaElement>`,
        default: `—`,
        description: `All other native textarea attributes forward (name, required, autoFocus, …).`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<TextareaDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.textarea;
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

const TEST_FILE = `lib/components/ui/textarea.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersNativeTextarea,
        testFile: TEST_FILE,
        testName: `renders a native textarea`,
        testLine: 9
    },
    {
        statement: statements.firesOnChange,
        testFile: TEST_FILE,
        testName: `fires onChange when the user types`,
        testLine: 15
    },
    {
        statement: statements.fullyControllable,
        testFile: TEST_FILE,
        testName: `is fully controllable via value + onChange`,
        testLine: 23
    },
    {
        statement: statements.forwardsRef,
        testFile: TEST_FILE,
        testName: `forwards a ref to the underlying textarea element`,
        testLine: 41
    },
    {
        statement: statements.disabledPreventsTyping,
        testFile: TEST_FILE,
        testName: `disabled prevents typing`,
        testLine: 47
    },
    {
        statement: statements.baseStyling,
        testFile: TEST_FILE,
        testName: `carries the min-height + rounded styling`,
        testLine: 56
    }
];

export const TextareaDocPage = () => {
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
                            example={textareaExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabled}
                        title={doc.examples.disabled.title}
                        description={doc.examples.disabled.description}
                    >
                        <ExampleCard
                            example={textareaExampleById(`disabled`)}
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
                <PropTable heading={`<Textarea>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default TextareaDocPage;
