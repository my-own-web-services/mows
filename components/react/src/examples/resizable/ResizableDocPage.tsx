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
import { resizableExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    vertical: `examples-vertical`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle
} from "@my-own-web-services/react-components";

<ResizablePanelGroup direction="horizontal">
    <ResizablePanel defaultSize={25}>Sidebar</ResizablePanel>
    <ResizableHandle />
    <ResizablePanel defaultSize={75}>Content</ResizablePanel>
</ResizablePanelGroup>`;

const COMPOSITION_SNIPPET = `// Set defaultSize on the panels you care about — the helper splits the
// remaining space evenly between any panel that doesn't declare one.
// Double-click on the handle resets the layout to the declared defaults.
// withHandle adds a visible grip indicator on the resize bar.

<ResizablePanelGroup direction="vertical">
    <ResizablePanel defaultSize={40}>Top</ResizablePanel>
    <ResizableHandle withHandle />
    <ResizablePanel defaultSize={60}>Bottom</ResizablePanel>
</ResizablePanelGroup>`;

const GROUP_PROPS: PropRow[] = [
    { name: `direction`, type: `"horizontal" | "vertical"`, default: `—`, description: `Required. Layout direction of the panels.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the group wrapper.` },
    { name: `...rest`, type: `ComponentProps<typeof PanelGroup>`, default: `—`, description: `All other react-resizable-panels PanelGroup props forward.` }
];

const PANEL_PROPS: PropRow[] = [
    { name: `defaultSize`, type: `number`, default: `—`, description: `Initial size of the panel as a percentage (0-100).` },
    { name: `minSize`, type: `number`, default: `—`, description: `Minimum size as a percentage.` },
    { name: `maxSize`, type: `number`, default: `—`, description: `Maximum size as a percentage.` },
    { name: `collapsible`, type: `boolean`, default: `false`, description: `Allow the panel to collapse below minSize.` }
];

const HANDLE_PROPS: PropRow[] = [
    { name: `withHandle`, type: `boolean`, default: `false`, description: `Render a visible grip indicator on the bar.` },
    { name: `onDoubleClick`, type: `MouseEventHandler`, default: `—`, description: `Extra handler — the built-in handler resets the layout to defaults regardless.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<ResizableDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.resizable;
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
                { id: ANCHOR.vertical, label: doc.examples.vertical.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/resizable.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.everyPanelDeclared,
        testFile: TEST_FILE,
        testName: `returns the declared sizes when every panel supplies one`,
        testLine: 15
    },
    {
        statement: statements.fillsMissing,
        testFile: TEST_FILE,
        testName: `fills missing defaults with the remainder split evenly`,
        testLine: 24
    },
    {
        statement: statements.splitsAcrossMany,
        testFile: TEST_FILE,
        testName: `splits the remainder across multiple panels without defaults`,
        testLine: 33
    },
    {
        statement: statements.returnsNullOnOverflow,
        testFile: TEST_FILE,
        testName: `returns null when an undeclared panel would need a negative remainder`,
        testLine: 44
    },
    {
        statement: statements.returnsNullWhenEmpty,
        testFile: TEST_FILE,
        testName: `returns null when there are no panels`,
        testLine: 57
    }
];

export const ResizableDocPage = () => {
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
                            example={resizableExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.vertical}
                        title={doc.examples.vertical.title}
                        description={doc.examples.vertical.description}
                    >
                        <ExampleCard
                            example={resizableExampleById(`vertical`)}
                            hideHeader
                        />
                    </DocSubsection>
                </div>
            </DocSection>

            <DocSection id={ANCHOR.usage} title={doc.usage.title} description={doc.usage.body}>
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
                    <PropTable heading={`<ResizablePanelGroup>`} rows={GROUP_PROPS} />
                    <PropTable heading={`<ResizablePanel>`} rows={PANEL_PROPS} />
                    <PropTable heading={`<ResizableHandle>`} rows={HANDLE_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default ResizableDocPage;
