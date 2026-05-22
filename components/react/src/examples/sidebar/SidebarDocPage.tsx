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
import { sidebarExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    iconCollapsible: `examples-icon-collapsible`,
    collapsibleGroups: `examples-collapsible-groups`,
    resizable: `examples-resizable`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider
} from "mows-components-react";

<SidebarProvider defaultOpen>
    <Sidebar>
        <SidebarHeader>my-app</SidebarHeader>
        <SidebarContent>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton>Dashboard</SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarContent>
    </Sidebar>
</SidebarProvider>`;

const COMPOSITION_SNIPPET = `// SidebarProvider owns the open/collapsed/width state and exposes it via
// useSidebar(). The Sidebar primitive composes Header / Content / Footer +
// Menu / MenuItem / MenuButton slots. Set resizable to enable the drag
// handle; the resolved width is persisted to a cookie.

<SidebarProvider resizable defaultWidthPx={240} minWidthPx={160} maxWidthPx={420}>
    <Sidebar>
        <SidebarHeader>…</SidebarHeader>
        <SidebarContent>
            <SidebarGroup>
                <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>{/* items */}</SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>…</SidebarFooter>
    </Sidebar>
</SidebarProvider>`;

const PROVIDER_PROPS: PropRow[] = [
    {
        name: `defaultOpen`,
        type: `boolean`,
        default: `true`,
        description: `Initial open/collapsed state. Read by useSidebar() and forwarded to <Sidebar>.`
    },
    {
        name: `open`,
        type: `boolean`,
        default: `—`,
        description: `Controlled open state. Pair with onOpenChange.`
    },
    {
        name: `onOpenChange`,
        type: `(open: boolean) => void`,
        default: `—`,
        description: `Called when the user toggles the sidebar.`
    },
    {
        name: `resizable`,
        type: `boolean`,
        default: `false`,
        description: `Enable the drag handle on the trailing edge of the fixed wrapper. The resulting width is persisted to a cookie (sidebar_width).`
    },
    {
        name: `defaultWidthPx`,
        type: `number`,
        default: `256`,
        description: `Seed width in pixels. Used until the user drags the handle.`
    },
    {
        name: `minWidthPx`,
        type: `number`,
        default: `192`,
        description: `Minimum width clamp during drag.`
    },
    {
        name: `maxWidthPx`,
        type: `number`,
        default: `640`,
        description: `Maximum width clamp during drag.`
    }
];

const SIDEBAR_PROPS: PropRow[] = [
    {
        name: `side`,
        type: `"left" | "right"`,
        default: `"left"`,
        description: `Which edge the sidebar pins to. Drag direction mirrors automatically when side="right".`
    },
    {
        name: `variant`,
        type: `"sidebar" | "floating" | "inset"`,
        default: `"sidebar"`,
        description: `Visual treatment — flush, floating-card, or inset border.`
    },
    {
        name: `collapsible`,
        type: `"offcanvas" | "icon" | "none"`,
        default: `"offcanvas"`,
        description: `Collapse mode. "icon" keeps the icon strip visible when collapsed; "offcanvas" slides off-screen.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the fixed-positioning wrapper.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<SidebarDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.sidebar;
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
                {
                    id: ANCHOR.iconCollapsible,
                    label: doc.examples.iconCollapsible.title
                },
                {
                    id: ANCHOR.collapsibleGroups,
                    label: doc.examples.collapsibleGroups.title
                },
                { id: ANCHOR.resizable, label: doc.examples.resizable.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/sidebar.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.cssVarApplies,
        testFile: TEST_FILE,
        testName: `uses Tailwind v4 var() syntax so width actually applies`,
        testLine: 80
    },
    {
        statement: statements.seedsDefaultWidth,
        testFile: TEST_FILE,
        testName: `seeds --sidebar-width from defaultWidthPx`,
        testLine: 89
    },
    {
        statement: statements.rendersHandleWhenResizable,
        testFile: TEST_FILE,
        testName: `renders the resize handle when resizable`,
        testLine: 94
    },
    {
        statement: statements.noHandleWhenNotResizable,
        testFile: TEST_FILE,
        testName: `does not render the resize handle when resizable is false`,
        testLine: 99
    },
    {
        statement: statements.dragPersists,
        testFile: TEST_FILE,
        testName: `updates width and persists to cookie on drag`,
        testLine: 110
    },
    {
        statement: statements.clampsToMax,
        testFile: TEST_FILE,
        testName: `clamps drag to maxWidthPx`,
        testLine: 117
    },
    {
        statement: statements.clampsToMin,
        testFile: TEST_FILE,
        testName: `clamps drag to minWidthPx`,
        testLine: 124
    },
    {
        statement: statements.doubleClickReset,
        testFile: TEST_FILE,
        testName: `double-clicking the handle resets to defaultWidthPx`,
        testLine: 131
    },
    {
        statement: statements.restoresFromCookie,
        testFile: TEST_FILE,
        testName: `restores the persisted width from cookie on mount`,
        testLine: 146
    },
    {
        statement: statements.reclampsPersisted,
        testFile: TEST_FILE,
        testName: `re-clamps a persisted width that falls outside new bounds`,
        testLine: 152
    },
    {
        statement: statements.dragsInwardOnRight,
        testFile: TEST_FILE,
        testName: `drags inward when the sidebar is on the right`,
        testLine: 158
    }
];

export const SidebarDocPage = () => {
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
                            example={sidebarExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.iconCollapsible}
                        title={doc.examples.iconCollapsible.title}
                        description={doc.examples.iconCollapsible.description}
                    >
                        <ExampleCard
                            example={sidebarExampleById(`iconCollapsible`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.collapsibleGroups}
                        title={doc.examples.collapsibleGroups.title}
                        description={doc.examples.collapsibleGroups.description}
                    >
                        <ExampleCard
                            example={sidebarExampleById(`collapsibleGroups`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.resizable}
                        title={doc.examples.resizable.title}
                        description={doc.examples.resizable.description}
                    >
                        <ExampleCard
                            example={sidebarExampleById(`resizable`)}
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
                    <PropTable heading={`<SidebarProvider>`} rows={PROVIDER_PROPS} />
                    <PropTable heading={`<Sidebar>`} rows={SIDEBAR_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default SidebarDocPage;
