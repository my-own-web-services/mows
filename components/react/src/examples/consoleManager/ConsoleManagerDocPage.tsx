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
import { consoleManagerExampleById } from "./index";

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

const USAGE_SNIPPET = `import { ConsoleManager } from "mows-components-react";

<ConsoleManager
    defaultTypeId="terminal"
    types={[
        { id: "terminal", label: "Terminal", render: () => <Terminal /> },
        { id: "logs", label: "Logs", render: () => <LogView lines={lines} /> }
    ]}
    initialTabs={[{ typeId: "terminal" }]}
/>`;

const COMPOSITION_SNIPPET = `// Each registered ConsoleType describes one console kind the manager
// can spawn tabs of. render() is called once per tab and the result stays
// mounted across tab/pane switches so long-running consoles don't reset.

const types: ConsoleType[] = [
    {
        id: "terminal",
        label: "Terminal",
        icon: TerminalSquare,
        render: () => <Terminal onReady={(h) => h.write("$ ")} />
    },
    {
        id: "logs",
        label: "Logs",
        icon: ScrollText,
        render: () => <LogView lines={lines} />
    }
];

<ConsoleManager
    types={types}
    initialTabs={[{ typeId: "terminal" }, { typeId: "logs" }]}
/>`;

const PROPS: PropRow[] = [
    { name: `types`, type: `readonly ConsoleType[]`, default: `—`, description: `Required. The console kinds the manager can spawn tabs of.` },
    { name: `defaultTypeId`, type: `string`, default: `types[0].id`, description: `Type spawned when clicking "+" with a single registered type.` },
    { name: `initialTabs`, type: `{ typeId: string }[]`, default: `[]`, description: `Pre-seeded tabs created on mount, in order.` },
    { name: `tabListDefaultSize`, type: `number`, default: `22`, description: `Initial right-panel width, as a percent of the surrounding resizable container.` },
    { name: `tabListMinSize`, type: `number`, default: `14`, description: `Minimum right-panel width (percent). Below this the user can't shrink the tab list further.` },
    { name: `tabListMaxSize`, type: `number`, default: `45`, description: `Maximum right-panel width (percent). Caps how far the tab list can expand.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) throw new Error(`<ConsoleManagerDocPage> must be rendered inside <MowsProvider>`);
    return ctx.t.example.examples.consoleManager;
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

const TEST_FILE = `lib/components/console/consoleManager/ConsoleManager.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.seedsTabs, testFile: TEST_FILE, testName: `renders one top-level group per seeded initial tab (VSCode model: + per terminal)`, testLine: 41 },
    { statement: statements.opensNewTab, testFile: TEST_FILE, testName: `+ opens a new top-level group (not a tab in an existing group)`, testLine: 59 },
    { statement: statements.splitRight, testFile: TEST_FILE, testName: `per-row Split adds a sibling inside the same group (VSCode createTerminal with parentTerminal)`, testLine: 75 },
    { statement: statements.closesTab, testFile: TEST_FILE, testName: `hover Kill closes the terminal and falls back to a sensible neighbour`, testLine: 151 },
    { statement: statements.collapseSplit, testFile: TEST_FILE, testName: `closing the last terminal in a group drops the group entirely`, testLine: 172 },
    { statement: statements.renamesOnDblClick, testFile: TEST_FILE, testName: `double-click → rename → Enter commits the new name`, testLine: 190 },
    { statement: statements.typePicker, testFile: TEST_FILE, testName: `shows the type-picker chevron when more than one console type is registered`, testLine: 207 },
    { statement: statements.keepsInactiveMounted, testFile: TEST_FILE, testName: `keeps all group bodies mounted so xterm state survives a group switch`, testLine: 227 },
    { statement: statements.dragReorder, testFile: TEST_FILE, testName: `drag-reorder: dragging a sibling onto another in the same group rewires the split tree`, testLine: 242 },
    { statement: statements.dragCrossPane, testFile: TEST_FILE, testName: `drag cross-group: pulling a terminal out of one group into another collapses the empty source group`, testLine: 281 }
];

export const ConsoleManagerDocPage = () => {
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
                        <ExampleCard example={consoleManagerExampleById(`default`)} hideHeader />
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
                <PropTable heading={`<ConsoleManager>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default ConsoleManagerDocPage;
