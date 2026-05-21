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
import { contextMenuExampleById } from "./index";

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

const USAGE_SNIPPET = `import {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator
} from "mows-components-react";

<ContextMenu>
    <ContextMenuTrigger className="block h-32 w-full border-2 border-dashed">
        Right-click here
    </ContextMenuTrigger>
    <ContextMenuContent>
        <ContextMenuItem>Mark as read</ContextMenuItem>
        <ContextMenuItem>Reply</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>Delete</ContextMenuItem>
    </ContextMenuContent>
</ContextMenu>`;

const COMPOSITION_SNIPPET = `// ContextMenu is the local equivalent of <GlobalContextMenu>: it wires
// onto the right-click event of one specific subtree (the trigger),
// rather than walking up the DOM for a data-actionscope. Use it for
// per-region menus that don't need to participate in the action manager.

<ContextMenu>
    <ContextMenuTrigger className="...">{content}</ContextMenuTrigger>
    <ContextMenuContent>
        <ContextMenuItem onSelect={() => doX()}>X</ContextMenuItem>
        <ContextMenuItem disabled>Disabled</ContextMenuItem>
    </ContextMenuContent>
</ContextMenu>`;

const PROPS: PropRow[] = [
    { name: `defaultOpen`, type: `boolean`, default: `false`, description: `Uncontrolled initial open state.` },
    { name: `onOpenChange`, type: `(open: boolean) => void`, default: `—`, description: `Fires when the menu opens or closes.` },
    { name: `modal`, type: `boolean`, default: `true`, description: `When true, scroll outside the menu is locked.` }
];

const ITEM_PROPS: PropRow[] = [
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable this single item. Clicks are ignored; the item gains data-disabled.` },
    { name: `onSelect`, type: `(event: Event) => void`, default: `—`, description: `Fires when the user selects this item via click / Enter.` },
    { name: `inset`, type: `boolean`, default: `false`, description: `Add left padding to align with other indented items.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<ContextMenuDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.contextMenu;
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

const TEST_FILE = `lib/components/ui/context-menu.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.closedByDefault,
        testFile: TEST_FILE,
        testName: `is closed by default — no menu items rendered`,
        testLine: 36
    },
    {
        statement: statements.opensOnContextmenu,
        testFile: TEST_FILE,
        testName: `opens on contextmenu event on the trigger`,
        testLine: 41
    },
    {
        statement: statements.firesOnSelect,
        testFile: TEST_FILE,
        testName: `fires onSelect when an item is clicked`,
        testLine: 48
    },
    {
        statement: statements.disabledIgnored,
        testFile: TEST_FILE,
        testName: `disabled items are exposed via aria-disabled and ignore selection`,
        testLine: 57
    },
    {
        statement: statements.closesOnSelect,
        testFile: TEST_FILE,
        testName: `closes when an enabled item is selected`,
        testLine: 69
    },
    {
        statement: statements.separator,
        testFile: TEST_FILE,
        testName: `renders a separator between item groups`,
        testLine: 77
    }
];

export const ContextMenuDocPage = () => {
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
                            example={contextMenuExampleById(`default`)}
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
                    <PropTable heading={`<ContextMenu>`} rows={PROPS} />
                    <PropTable heading={`<ContextMenuItem>`} rows={ITEM_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default ContextMenuDocPage;
