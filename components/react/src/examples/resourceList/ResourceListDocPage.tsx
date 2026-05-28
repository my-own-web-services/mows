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
import { resourceListExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    grid: `examples-grid`,
    multipleLayouts: `examples-multiple-layouts`,
    selection: `examples-selection`,
    reorderable: `examples-reorderable`,
    crossListDrag: `examples-cross-list-drag`,
    contextMenu: `examples-context-menu`,
    multipleListsSharedAction: `examples-multiple-lists-shared-action`,
    horizontalStrip: `examples-horizontal-strip`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import {
    ResourceList,
    ColumnListRowHandler,
    SortDirection
} from "@my-own-web-services/react-components";

interface User {
    id: string;
    name: string;
    email: string;
}

const columnHandler = new ColumnListRowHandler<User>({
    columns: [
        {
            field: "name",
            label: "Name",
            direction: SortDirection.Ascending,
            widthPercent: 50,
            minWidthPixels: 120,
            enabled: true,
            render: (u) => <span>{u.name}</span>
        },
        {
            field: "email",
            label: "Email",
            direction: SortDirection.Neutral,
            widthPercent: 50,
            minWidthPixels: 200,
            enabled: true,
            render: (u) => <span>{u.email}</span>
        }
    ]
});

<ResourceList<User>
    listInstanceId="users"
    resourceType="user"
    rowHandlers={[columnHandler]}
    initialRowHandler={columnHandler.id}
    getResourcesList={fetchUsers}
    defaultSortBy="name"
/>`;

const COMPOSITION_SNIPPET = `// ResourceList is paginated + virtualised. Wire its data via
// getResourcesList(req): the request describes a contiguous window
// (fromIndex, limit, sortBy, sortDirection) and the response carries
// the items for that window plus the total count.

const fetchUsers = async (
    req: ListResourceRequestBody
): Promise<ListResourceResponseBody<User>> => {
    const r = await api.users.list({
        offset: req.fromIndex,
        limit: req.limit,
        sortBy: req.sortBy,
        sortDirection: req.sortDirection
    });
    return { items: r.items, totalCount: r.totalCount };
};

// Row layout is controlled by a row handler. Pass multiple handlers and
// the user can switch between Column / Grid / custom layouts via the
// header buttons — the list keeps its scroll position.
const columnHandler = new ColumnListRowHandler<User>({ columns });
const gridHandler = new GridListRowHandler<User>({
    defaultGridColumnCount: 6,
    cellRenderer: (u) => <UserCard user={u} />
});

<ResourceList<User>
    listInstanceId="users"
    resourceType="user"
    rowHandlers={[columnHandler, gridHandler]}
    initialRowHandler={columnHandler.id}
    getResourcesList={fetchUsers}
    handlers={{
        onSelect: (selected, last) => {
            console.log("selected", selected.length, "last", last?.id);
        }
    }}
/>`;

const PROPS: PropRow[] = [
    { name: `listInstanceId`, type: `string`, default: `—`, description: `Required. DOM-unique id used for keyboard / drag-and-drop scoping.` },
    { name: `resourceType`, type: `string`, default: `—`, description: `Required. Logical name of the resource being listed (e.g. "deployment", "swatch", "user").` },
    { name: `rowHandlers`, type: `ListRowHandler<T>[]`, default: `—`, description: `Required. The available row layouts the user can switch between. Pass more than one to expose the layout picker in the header.` },
    { name: `initialRowHandler`, type: `string`, default: `—`, description: `Required. id of the row handler to render first; must match one of rowHandlers.` },
    { name: `getResourcesList`, type: `(req) => Promise<ListResourceResponseBody<T>>`, default: `—`, description: `Required. Server-side data source for a contiguous window of items.` },
    { name: `defaultSortBy`, type: `string`, default: `"CreatedTime"`, description: `Field name to sort by on first fetch.` },
    { name: `defaultSortDirection`, type: `SortDirection`, default: `Descending`, description: `Sort direction on first fetch.` },
    { name: `displayListHeader`, type: `boolean`, default: `true`, description: `Hide the header bar (row-handler picker / refresh) when false.` },
    { name: `listHeaderElement`, type: `JSX.Element`, default: `—`, description: `Custom content rendered inside the header bar.` },
    { name: `overscanCount`, type: `number`, default: `20`, description: `Number of items rendered outside the visible window for smoother scrolling.` },
    { name: `handlers`, type: `ResourceListHandlers<T>`, default: `—`, description: `Optional event-handler bag: onSelect, onSearch, onRefresh, onCreateClick, onListTypeChange, onItemRightClick, onReorder, onItemsAccepted, onItemsMovedOut.` },
    { name: `dropTargetAcceptsTypes`, type: `string[]`, default: `—`, description: `Drag-and-drop: which payload types the list accepts as a drop target.` },
    { name: `reorderable`, type: `boolean`, default: `false`, description: `When true, the Column row handler renders a drag grip on every row and the list emits handlers.onReorder(fromIndex, toIndex) after a successful drop.` },
    { name: `reorderAcceptsFrom`, type: `string[]`, default: `—`, description: `Other listInstanceIds whose drags this list will accept as drops. The list always accepts drags from itself. While a drag is in flight, lists not in this set render a "does not accept drops" overlay.` },
    { name: `displayDebugBar`, type: `boolean`, default: `false`, description: `Show an internal debug bar with the current fetch / window state.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<ResourceListDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.resourceList;
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
                { id: ANCHOR.grid, label: doc.examples.grid.title },
                { id: ANCHOR.multipleLayouts, label: doc.examples.multipleLayouts.title },
                { id: ANCHOR.selection, label: doc.examples.selection.title },
                { id: ANCHOR.reorderable, label: doc.examples.reorderable.title },
                { id: ANCHOR.crossListDrag, label: doc.examples.crossListDrag.title },
                { id: ANCHOR.contextMenu, label: doc.examples.contextMenu.title },
                {
                    id: ANCHOR.multipleListsSharedAction,
                    label: doc.examples.multipleListsSharedAction.title
                },
                { id: ANCHOR.horizontalStrip, label: doc.examples.horizontalStrip.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/list/ResourceList/ResourceList.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.callsFetcher, testFile: TEST_FILE, testName: `calls getResourcesList on mount`, testLine: 238 },
    { statement: statements.firstWindow, testFile: TEST_FILE, testName: `first fetch passes fromIndex=0 + a finite limit`, testLine: 247 },
    { statement: statements.forwardsSort, testFile: TEST_FILE, testName: `forwards a sortBy + sortDirection in the request body`, testLine: 260 },
    { statement: statements.reorderFires, testFile: TEST_FILE, testName: `fires onReorder when a row is dropped onto another row`, testLine: 409 },
    { statement: statements.crossListAccept, testFile: TEST_FILE, testName: `accepts a drop from a list whose id is in reorderAcceptsFrom`, testLine: 756 }
];

export const ResourceListDocPage = () => {
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
                        <ExampleCard example={resourceListExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.grid}
                        title={doc.examples.grid.title}
                        description={doc.examples.grid.description}
                    >
                        <ExampleCard example={resourceListExampleById(`grid`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.multipleLayouts}
                        title={doc.examples.multipleLayouts.title}
                        description={doc.examples.multipleLayouts.description}
                    >
                        <ExampleCard example={resourceListExampleById(`multipleLayouts`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.selection}
                        title={doc.examples.selection.title}
                        description={doc.examples.selection.description}
                    >
                        <ExampleCard example={resourceListExampleById(`selection`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.reorderable}
                        title={doc.examples.reorderable.title}
                        description={doc.examples.reorderable.description}
                    >
                        <ExampleCard example={resourceListExampleById(`reorderable`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.crossListDrag}
                        title={doc.examples.crossListDrag.title}
                        description={doc.examples.crossListDrag.description}
                    >
                        <ExampleCard example={resourceListExampleById(`crossListDrag`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.contextMenu}
                        title={doc.examples.contextMenu.title}
                        description={doc.examples.contextMenu.description}
                    >
                        <ExampleCard example={resourceListExampleById(`contextMenu`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.multipleListsSharedAction}
                        title={doc.examples.multipleListsSharedAction.title}
                        description={doc.examples.multipleListsSharedAction.description}
                    >
                        <ExampleCard
                            example={resourceListExampleById(`multipleListsSharedAction`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.horizontalStrip}
                        title={doc.examples.horizontalStrip.title}
                        description={doc.examples.horizontalStrip.description}
                    >
                        <ExampleCard example={resourceListExampleById(`horizontalStrip`)} hideHeader />
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
                <PropTable heading={`<ResourceList>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default ResourceListDocPage;
