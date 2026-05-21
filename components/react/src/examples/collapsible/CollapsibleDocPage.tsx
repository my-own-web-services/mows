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
import { collapsibleExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    controlled: `examples-controlled`,
    nested: `examples-nested`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "mows-components-react";

<Collapsible defaultOpen>
    <CollapsibleTrigger>Toggle</CollapsibleTrigger>
    <CollapsibleContent>Hidden body</CollapsibleContent>
</Collapsible>`;

const COMPOSITION_SNIPPET = `// Collapsible wraps the Radix Collapsible primitive. The trigger receives
// data-state="open" | "closed"; tag your chevron with
// data-[state=open]:rotate-90 (or use a CSS transition) to animate it.

<Collapsible className="group/collapsible">
    <CollapsibleTrigger className="flex w-full items-center gap-2">
        <span>Section</span>
        <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
    </CollapsibleTrigger>
    <CollapsibleContent>{children}</CollapsibleContent>
</Collapsible>`;

const ROOT_PROPS: PropRow[] = [
    {
        name: `open`,
        type: `boolean`,
        default: `—`,
        description: `Controlled open state. Pair with onOpenChange.`
    },
    {
        name: `defaultOpen`,
        type: `boolean`,
        default: `false`,
        description: `Uncontrolled initial state.`
    },
    {
        name: `onOpenChange`,
        type: `(open: boolean) => void`,
        default: `—`,
        description: `Fires when the user toggles the content.`
    },
    {
        name: `disabled`,
        type: `boolean`,
        default: `false`,
        description: `Disable the trigger; the content stays in its current state.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the root element.`
    }
];

const TRIGGER_PROPS: PropRow[] = [
    {
        name: `asChild`,
        type: `boolean`,
        default: `false`,
        description: `Render as the immediate child via Radix Slot — use this to attach the trigger to your own button / link element.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the trigger.`
    }
];

const CONTENT_PROPS: PropRow[] = [
    {
        name: `forceMount`,
        type: `boolean`,
        default: `false`,
        description: `Always keep the content mounted in the DOM, leaving visibility to your CSS. Useful for animations.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the content wrapper.`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<CollapsibleDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.collapsible;
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
                { id: ANCHOR.controlled, label: doc.examples.controlled.title },
                { id: ANCHOR.nested, label: doc.examples.nested.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/ui/collapsible.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.closedByDefault,
        testFile: TEST_FILE,
        testName: `renders closed by default`,
        testLine: 16
    },
    {
        statement: statements.reflectsDefaultOpen,
        testFile: TEST_FILE,
        testName: `reflects defaultOpen on first mount`,
        testLine: 23
    },
    {
        statement: statements.opensClosesOnClick,
        testFile: TEST_FILE,
        testName: `opens and closes on trigger click`,
        testLine: 32
    },
    {
        statement: statements.firesOnOpenChange,
        testFile: TEST_FILE,
        testName: `fires onOpenChange when toggled`,
        testLine: 42
    },
    {
        statement: statements.fullyControllable,
        testFile: TEST_FILE,
        testName: `is fully controllable via open + onOpenChange`,
        testLine: 50
    },
    {
        statement: statements.disabledNoToggle,
        testFile: TEST_FILE,
        testName: `does not toggle when disabled`,
        testLine: 70
    }
];

export const CollapsibleDocPage = () => {
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
                            example={collapsibleExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.controlled}
                        title={doc.examples.controlled.title}
                        description={doc.examples.controlled.description}
                    >
                        <ExampleCard
                            example={collapsibleExampleById(`controlled`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.nested}
                        title={doc.examples.nested.title}
                        description={doc.examples.nested.description}
                    >
                        <ExampleCard
                            example={collapsibleExampleById(`nested`)}
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
                    <PropTable heading={`<Collapsible>`} rows={ROOT_PROPS} />
                    <PropTable heading={`<CollapsibleTrigger>`} rows={TRIGGER_PROPS} />
                    <PropTable heading={`<CollapsibleContent>`} rows={CONTENT_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default CollapsibleDocPage;
