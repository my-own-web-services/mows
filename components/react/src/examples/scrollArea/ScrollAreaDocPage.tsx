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
import { scrollAreaExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    horizontal: `examples-horizontal`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { ScrollArea } from "mows-components-react";

<ScrollArea className="h-48 w-full max-w-md rounded-md border p-4">
    {items.map(...)}
</ScrollArea>`;

const COMPOSITION_SNIPPET = `// ScrollArea wraps the Radix ScrollArea primitive with sensible defaults
// (vertical scrollbar baked in, custom-styled thumb). For horizontal
// scrolling, render an explicit <ScrollBar orientation="horizontal" /> at
// the end of the children — Radix renders both bars side-by-side.

<ScrollArea className="w-full whitespace-nowrap rounded-md border">
    <div className="flex gap-3 p-4">{cards}</div>
    <ScrollBar orientation="horizontal" />
</ScrollArea>

// Drive scroll from outside via viewportRef:
const viewportRef = useRef<HTMLDivElement>(null);
useEffect(() => viewportRef.current?.scrollTo({ top: 9999 }), [lines]);

<ScrollArea viewportRef={viewportRef}>...</ScrollArea>`;

const ROOT_PROPS: PropRow[] = [
    {
        name: `viewportRef`,
        type: `Ref<HTMLDivElement>`,
        default: `—`,
        description: `Ref forwarded onto the inner viewport — useful for imperative scrollTo from a parent (autoscroll log viewers, sticky-bottom feeds, etc.).`
    },
    {
        name: `viewportClassName`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the viewport (inside the root, before the scrollbars).`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the outer relative-positioned wrapper.`
    },
    {
        name: `...rest`,
        type: `ComponentProps<typeof ScrollAreaPrimitive.Root>`,
        default: `—`,
        description: `All other Radix ScrollArea.Root props forward.`
    }
];

const BAR_PROPS: PropRow[] = [
    {
        name: `orientation`,
        type: `"vertical" | "horizontal"`,
        default: `"vertical"`,
        description: `Scroll direction. ScrollArea includes a vertical bar by default — render an explicit <ScrollBar orientation="horizontal"/> for horizontal content.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the scrollbar track.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<ScrollAreaDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.scrollArea;
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
                { id: ANCHOR.horizontal, label: doc.examples.horizontal.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/scroll-area.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.shell,
        testFile: TEST_FILE,
        testName: `renders the relative-positioned overflow-hidden shell`,
        testLine: 7
    },
    {
        statement: statements.viewport,
        testFile: TEST_FILE,
        testName: `renders the children inside a viewport with h-full / w-full`,
        testLine: 14
    },
    {
        statement: statements.viewportRef,
        testFile: TEST_FILE,
        testName: `forwards viewportRef to the inner viewport`,
        testLine: 23
    },
    {
        statement: statements.viewportClassName,
        testFile: TEST_FILE,
        testName: `merges viewportClassName onto the viewport`,
        testLine: 30
    }
];

export const ScrollAreaDocPage = () => {
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
                            example={scrollAreaExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.horizontal}
                        title={doc.examples.horizontal.title}
                        description={doc.examples.horizontal.description}
                    >
                        <ExampleCard
                            example={scrollAreaExampleById(`horizontal`)}
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
                    <PropTable heading={`<ScrollArea>`} rows={ROOT_PROPS} />
                    <PropTable heading={`<ScrollBar>`} rows={BAR_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default ScrollAreaDocPage;
