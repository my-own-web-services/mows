import { Box } from "lucide-react";
import * as React from "react";
import PrimaryMenu from "../../lib/components/appShell/primaryMenu/PrimaryMenu";
import CodeViewer from "../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../lib/components/code/expandableCode/ExpandableCode";
import { type PageIndexItem } from "../../lib/components/navigation/pageIndex/PageIndex";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider
} from "../../lib/components/ui/sidebar";
import { MowsContext } from "../../lib/lib/mowsContext/MowsContext";
import { DocPage, DocSection, DocSubsection } from "../examples/harness/docPage";

const ANCHOR = {
    setup: `setup`,
    setupProvider: `setup-provider`,
    setupAppShell: `setup-app-shell`,
    patterns: `patterns`,
    patternSidebar: `pattern-sidebar`,
    actions: `actions`,
    actionsDefine: `actions-define`,
    actionsExtra: `actions-extra`,
    actionsContextMenu: `actions-context-menu`,
    actionsVariants: `actions-variants`
} as const;

const PROVIDER_SNIPPET = `import { MowsProvider } from "@my-own-web-services/react-components";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
    <MowsProvider storagePrefix="my-app">
        <App />
    </MowsProvider>
);`;

const APP_SHELL_SNIPPET = `import {
    CommandPalette,
    GlobalContextMenu,
    ModalHandler,
    MowsProvider,
    Toaster
} from "@my-own-web-services/react-components";

export const Root = () => (
    <MowsProvider storagePrefix="my-app">
        <App />

        {/* The four required app-shell mounts. Render nothing on their own
            — they exist as targets for useMows() / actions / toasts. Skip
            one and the matching call site silently no-ops. */}
        <CommandPalette />
        <ModalHandler />
        <GlobalContextMenu />
        <Toaster />
    </MowsProvider>
);`;

const DEFINE_ACTION_SNIPPET = `import {
    Action,
    ActionVisibility
} from "@my-own-web-services/react-components/lib/mowsContext/ActionManager";
import { Plus } from "lucide-react";

// Stable, namespaced ids — they show up in localStorage (recents,
// hotkey overrides) and the command palette, so don't rename them
// lightly.
export enum AppActionIds {
    CREATE_DOCUMENT = "myapp.document.create",
    DELETE_DOCUMENT = "myapp.document.delete"
}

// Build once and pass into <MowsProvider extraActions={…}>. The same
// Action instance can carry multiple handlers — one per scope — so
// the command palette, a hotkey, and a context menu can all dispatch
// the same id with different behaviour.
export const buildAppActions = (): Action[] => [
    new Action({
        id: AppActionIds.CREATE_DOCUMENT,
        category: "Documents",
        actionHandlers: new Map([
            [
                "global",
                {
                    id: "GlobalCreateDocument",
                    executeAction: () => createDocument(),
                    // \`visibility\` drives both the command palette and
                    // the context menu. Use Disabled (not Hidden) when
                    // the action exists but can't run right now —
                    // disabled rows are still discoverable.
                    getState: () => ({
                        visibility: ActionVisibility.Shown,
                        icon: () => <Plus />
                    })
                }
            ]
        ])
    })
];`;

const REGISTER_ACTIONS_SNIPPET = `import { MowsProvider } from "@my-own-web-services/react-components";
import { buildAppActions } from "./actions";

createRoot(document.getElementById("root")!).render(
    <MowsProvider
        storagePrefix="my-app"
        extraActions={buildAppActions()}
    >
        <App />
        <CommandPalette />
        <ModalHandler />
        <GlobalContextMenu />
        <Toaster />
    </MowsProvider>
);`;

const CONTEXT_MENU_SNIPPET = `// 1. Mark which DOM regions a scope applies to. \`data-actionscope\`
//    names the scope; everything else is whatever payload your
//    handler needs to identify the target.
<li
    data-actionscope="document-row"
    data-doc-id={doc.id}
    data-doc-name={doc.name}
>
    {doc.name}
</li>

// 2. Define the action with a handler keyed to that scope. The
//    handler's \`executeAction\` receives the original click event
//    and the \`[data-actionscope]\` element the user right-clicked,
//    so you read identifiers off that element instead of
//    re-traversing the DOM.
new Action({
    id: AppActionIds.DELETE_DOCUMENT,
    category: "Documents",
    actionHandlers: new Map([
        [
            "document-row",
            {
                id: "DocumentRowDelete",
                scopes: ["document-row"],
                executeAction: (_event, target) => {
                    const id = target?.getAttribute("data-doc-id");
                    if (!id) return;
                    deleteDocument(id);
                },
                getState: () => ({
                    visibility: ActionVisibility.Shown,
                    icon: () => <Trash2 />
                })
            }
        ]
    ])
})

// 3. Make sure <GlobalContextMenu /> is mounted somewhere inside
//    <MowsProvider>. Right-clicking the marked DOM region now
//    opens a popover listing every action whose handler's
//    \`scopes\` includes \`"document-row"\`. Outside that region the
//    browser's native context menu shows up — the suppression is
//    deliberately scoped so normal copy/paste keeps working.`;

const VARIANTS_SNIPPET = `new Action({
    id: AppActionIds.DELETE_DOCUMENT,
    category: "Documents",
    actionHandlers: new Map([
        [
            "document-row",
            {
                id: "DocumentRowDelete",
                scopes: ["document-row"],
                executeAction: (_event, target) => {
                    moveToBin(target?.getAttribute("data-doc-id")!);
                },
                getState: () => ({
                    visibility: ActionVisibility.Shown,
                    label: "Move to bin",
                    icon: () => <Trash2 />
                }),
                // Variants resolve top-to-bottom against the live
                // modifier mask — first match wins. Place the most
                // specific predicate first.
                variants: [
                    {
                        when: (mods) => mods.shift,
                        label: "Delete permanently",
                        icon: () => <TrashX />,
                        execute: (_event, target) => {
                            permanentlyDelete(
                                target?.getAttribute("data-doc-id")!
                            );
                        }
                    }
                ]
            }
        ]
    ])
})`;

const SIDEBAR_LAYOUT_SNIPPET = `import {
    PrimaryMenu,
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarInset,
    SidebarProvider
} from "@my-own-web-services/react-components";

export const AppShell = ({ children }: { children: React.ReactNode }) => (
    <SidebarProvider>
        <div className="flex h-screen w-full bg-background text-foreground">
            <Sidebar collapsible="none" className="h-full">
                <SidebarHeader>
                    <div className="flex items-center gap-2 px-1 pb-1 text-sm font-semibold">
                        <img
                            src="/your-app-logo.svg"
                            alt="Your app logo"
                            className="h-6 w-6 shrink-0"
                        />
                        <span className="truncate">Your App Name</span>
                    </div>
                </SidebarHeader>

                <SidebarContent>
                    {/* Route nav lives here — typically a list of
                        <SidebarMenuItem><SidebarMenuButton asChild>
                          <a href={route.href}>{route.label}</a>
                        </SidebarMenuButton></SidebarMenuItem> entries. */}
                </SidebarContent>

                {/* PrimaryMenu in the footer slot owns theme / language /
                    auth controls. variant="inline" brings its own divider
                    + edge-to-edge padding so it sits flush as the
                    sidebar's bottom bar. */}
                <PrimaryMenu
                    variant="inline"
                    user={{ displayName: "Demo", id: "demo" }}
                />
            </Sidebar>

            <SidebarInset className="flex-1 min-w-0">{children}</SidebarInset>
        </div>
    </SidebarProvider>
);`;

// Renders a live, sized example of what the snippet produces. Kept fully
// self-contained — its own SidebarProvider, its own Sidebar, no outer state
// — so it can live anywhere on the page without coupling to the docs shell.
const SidebarLayoutPreview = () => (
    <div className={`relative h-[420px] overflow-hidden rounded-md border`}>
        <SidebarProvider defaultOpen className={`min-h-0`}>
            <Sidebar collapsible={`none`} className={`absolute`}>
                <SidebarHeader>
                    {/* Neutral icon as a placeholder for the consumer's
                        own app logo. */}
                    <div
                        className={`flex items-center gap-2 px-1 pb-1 text-sm font-semibold`}
                    >
                        <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-dashed text-muted-foreground`}
                            aria-hidden
                        >
                            <Box className={`h-3.5 w-3.5`} aria-hidden />
                        </div>
                        <span className={`truncate`}>Your App Name</span>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {[`Dashboard`, `Files`, `Console`, `Settings`].map(
                                    (label, idx) => (
                                        <SidebarMenuItem key={label}>
                                            <SidebarMenuButton isActive={idx === 0}>
                                                {label}
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )
                                )}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <PrimaryMenu
                    variant={`inline`}
                    user={{ displayName: `Demo User`, id: `demo-user-id` }}
                />
            </Sidebar>
        </SidebarProvider>
    </div>
);

const useGuideStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<CreatingAppsGuide> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.guides.creatingApps;
};

export const CreatingAppsGuide = () => {
    const t = useGuideStrings();

    const indexItems: PageIndexItem[] = React.useMemo(
        () => [
            {
                id: ANCHOR.setup,
                label: t.setup.title,
                children: [
                    { id: ANCHOR.setupProvider, label: t.setup.provider.title },
                    { id: ANCHOR.setupAppShell, label: t.setup.appShell.title }
                ]
            },
            {
                id: ANCHOR.patterns,
                label: t.patterns.title,
                children: [
                    { id: ANCHOR.patternSidebar, label: t.patterns.sidebar.title }
                ]
            },
            {
                id: ANCHOR.actions,
                label: t.actions.title,
                children: [
                    { id: ANCHOR.actionsDefine, label: t.actions.define.title },
                    { id: ANCHOR.actionsExtra, label: t.actions.register.title },
                    {
                        id: ANCHOR.actionsContextMenu,
                        label: t.actions.contextMenu.title
                    },
                    { id: ANCHOR.actionsVariants, label: t.actions.variants.title }
                ]
            }
        ],
        [t.setup, t.patterns, t.actions]
    );

    return (
        <DocPage indexItems={indexItems}>
            <DocSection
                id={ANCHOR.setup}
                title={t.setup.title}
                description={t.setup.intro}
            >
                <DocSubsection
                    id={ANCHOR.setupProvider}
                    title={t.setup.provider.title}
                    description={t.setup.provider.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={PROVIDER_SNIPPET}
                            language={`tsx`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.setupAppShell}
                    title={t.setup.appShell.title}
                    description={t.setup.appShell.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={APP_SHELL_SNIPPET}
                            language={`tsx`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>
            </DocSection>

            <DocSection
                id={ANCHOR.patterns}
                title={t.patterns.title}
                description={t.patterns.intro}
            >
                <DocSubsection
                    id={ANCHOR.patternSidebar}
                    title={t.patterns.sidebar.title}
                    description={t.patterns.sidebar.body}
                >
                    <div className={`flex flex-col gap-4`}>
                        <SidebarLayoutPreview />
                        <ExpandableCode>
                            <CodeViewer
                                code={SIDEBAR_LAYOUT_SNIPPET}
                                language={`tsx`}
                                fitContent
                            />
                        </ExpandableCode>
                    </div>
                </DocSubsection>
            </DocSection>

            <DocSection
                id={ANCHOR.actions}
                title={t.actions.title}
                description={t.actions.intro}
            >
                <DocSubsection
                    id={ANCHOR.actionsDefine}
                    title={t.actions.define.title}
                    description={t.actions.define.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={DEFINE_ACTION_SNIPPET}
                            language={`tsx`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.actionsExtra}
                    title={t.actions.register.title}
                    description={t.actions.register.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={REGISTER_ACTIONS_SNIPPET}
                            language={`tsx`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.actionsContextMenu}
                    title={t.actions.contextMenu.title}
                    description={t.actions.contextMenu.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={CONTEXT_MENU_SNIPPET}
                            language={`tsx`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>

                <DocSubsection
                    id={ANCHOR.actionsVariants}
                    title={t.actions.variants.title}
                    description={t.actions.variants.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={VARIANTS_SNIPPET}
                            language={`tsx`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>
            </DocSection>
        </DocPage>
    );
};

export default CreatingAppsGuide;
