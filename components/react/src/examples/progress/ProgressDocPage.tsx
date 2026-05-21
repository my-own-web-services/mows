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
import { progressExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    animated: `examples-animated`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { Progress } from "mows-components-react";

<Progress value={60} />`;

const COMPOSITION_SNIPPET = `// Progress is the Radix Progress primitive. value is a number 0-100; pass
// undefined for an indeterminate state. The indicator slides via
// transform: translateX so the animation is GPU-accelerated.

const [value, setValue] = useState(0);

useEffect(() => {
    const id = setInterval(() => setValue((v) => (v >= 100 ? 0 : v + 5)), 300);
    return () => clearInterval(id);
}, []);

<Progress value={value} />`;

const PROPS: PropRow[] = [
    {
        name: `value`,
        type: `number | null`,
        default: `—`,
        description: `Progress value (0-100). Omit or pass null for an indeterminate indicator (treated as 0 by the visual indicator).`
    },
    {
        name: `max`,
        type: `number`,
        default: `100`,
        description: `Maximum value forwarded onto the Radix primitive for accessibility.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the track wrapper.`
    },
    {
        name: `...rest`,
        type: `ComponentProps<typeof RadixProgress.Root>`,
        default: `—`,
        description: `All other Radix Progress props forward (aria-label, getValueLabel, …).`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<ProgressDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.progress;
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
                { id: ANCHOR.animated, label: doc.examples.animated.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/progress.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersTrack,
        testFile: TEST_FILE,
        testName: `renders the track with a relative-positioned overflow-hidden shell`,
        testLine: 13
    },
    {
        statement: statements.translateAtZero,
        testFile: TEST_FILE,
        testName: `translates the indicator by -100% at value=0`,
        testLine: 21
    },
    {
        statement: statements.translateAtFifty,
        testFile: TEST_FILE,
        testName: `translates the indicator by -50% at value=50`,
        testLine: 27
    },
    {
        statement: statements.translateAtHundred,
        testFile: TEST_FILE,
        testName: `translates the indicator by 0 at value=100`,
        testLine: 33
    },
    {
        statement: statements.omittedAsZero,
        testFile: TEST_FILE,
        testName: `treats an omitted value as 0`,
        testLine: 39
    },
    {
        statement: statements.classNameMerge,
        testFile: TEST_FILE,
        testName: `merges a custom className with the base classes`,
        testLine: 45
    }
];

export const ProgressDocPage = () => {
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
                            example={progressExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.animated}
                        title={doc.examples.animated.title}
                        description={doc.examples.animated.description}
                    >
                        <ExampleCard
                            example={progressExampleById(`animated`)}
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
                <PropTable heading={`<Progress>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default ProgressDocPage;
