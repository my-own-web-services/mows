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
import { popoverExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    form: `examples-form`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { Popover, PopoverTrigger, PopoverContent } from "mows-components-react";

<Popover>
    <PopoverTrigger asChild>
        <Button variant="outline">Open</Button>
    </PopoverTrigger>
    <PopoverContent>body</PopoverContent>
</Popover>`;

const COMPOSITION_SNIPPET = `// Popovers are non-modal: clicks outside dismiss them, focus is not
// trapped. Use them for inline forms and lightweight transient panels.
// For modal blocking interactions reach for <Dialog> instead.

<Popover>
    <PopoverTrigger asChild>
        <Button variant="outline">Edit name</Button>
    </PopoverTrigger>
    <PopoverContent className="w-80">
        <form>...</form>
    </PopoverContent>
</Popover>`;

const ROOT_PROPS: PropRow[] = [
    { name: `open`, type: `boolean`, default: `—`, description: `Controlled open state. Pair with onOpenChange.` },
    { name: `defaultOpen`, type: `boolean`, default: `false`, description: `Uncontrolled initial open state.` },
    { name: `onOpenChange`, type: `(open: boolean) => void`, default: `—`, description: `Fires whenever the open state changes.` },
    { name: `modal`, type: `boolean`, default: `false`, description: `When true, the popover behaves modally (focus trap + scroll lock). Defaults to false — most popovers should stay non-modal.` }
];

const CONTENT_PROPS: PropRow[] = [
    { name: `align`, type: `"start" | "center" | "end"`, default: `"center"`, description: `Alignment along the trigger's edge.` },
    { name: `side`, type: `"top" | "right" | "bottom" | "left"`, default: `"bottom"`, description: `Which side of the trigger the popover opens on.` },
    { name: `sideOffset`, type: `number`, default: `4`, description: `Gap between trigger and popover in px.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the popover surface.` },
    { name: `...rest`, type: `ComponentProps<typeof PopoverPrimitive.Content>`, default: `—`, description: `All other Radix Popover.Content props forward.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<PopoverDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.popover;
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
                { id: ANCHOR.form, label: doc.examples.form.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/popover.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.closedByDefault,
        testFile: TEST_FILE,
        testName: `is closed by default — content is not rendered`,
        testLine: 16
    },
    {
        statement: statements.defaultOpen,
        testFile: TEST_FILE,
        testName: `renders the content when defaultOpen is set`,
        testLine: 21
    },
    {
        statement: statements.opensOnTrigger,
        testFile: TEST_FILE,
        testName: `opens when the trigger is clicked`,
        testLine: 26
    },
    {
        statement: statements.closesOnEscape,
        testFile: TEST_FILE,
        testName: `closes on Escape`,
        testLine: 33
    },
    {
        statement: statements.portalsToBody,
        testFile: TEST_FILE,
        testName: `portals the content to a separate node (not nested in the trigger's parent div)`,
        testLine: 40
    }
];

export const PopoverDocPage = () => {
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
                            example={popoverExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.form}
                        title={doc.examples.form.title}
                        description={doc.examples.form.description}
                    >
                        <ExampleCard
                            example={popoverExampleById(`form`)}
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
                    <PropTable heading={`<Popover>`} rows={ROOT_PROPS} />
                    <PropTable heading={`<PopoverContent>`} rows={CONTENT_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default PopoverDocPage;
