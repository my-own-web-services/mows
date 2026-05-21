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
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { ResourceList } from "mows-components-react";

<ResourceList
    listInstanceId="users"
    resourceType="user"
    rowHandlers={[handler]}
    initialRowHandler={handler.id}
    getResourcesList={fetchUsers}
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

// Row layout is controlled by a row handler. Switch handlers via the
// header buttons to swap between Column / Grid / etc. renderings.
const columnHandler = new ColumnListRowHandler<User>({ columns });
const gridHandler = new GridListRowHandler<User>({ render: (u) => <UserCard user={u} /> });

<ResourceList
    listInstanceId="users"
    resourceType="user"
    rowHandlers={[columnHandler, gridHandler]}
    initialRowHandler={columnHandler.id}
    getResourcesList={fetchUsers}
/>`;

const PROPS: PropRow[] = [
    { name: `listInstanceId`, type: `string`, default: `—`, description: `Required. DOM-unique id used for keyboard / drag-and-drop scoping.` },
    { name: `resourceType`, type: `string`, default: `—`, description: `Required. Logical name of the resource being listed (e.g. "file", "user").` },
    { name: `rowHandlers`, type: `ListRowHandler<T>[]`, default: `—`, description: `Required. The available row layouts the user can switch between.` },
    { name: `initialRowHandler`, type: `string`, default: `—`, description: `Required. id of the row handler to render first; must match one of rowHandlers.` },
    { name: `getResourcesList`, type: `(req) => Promise<ListResourceResponseBody<T>>`, default: `—`, description: `Required. Server-side data source for a contiguous window of items.` },
    { name: `defaultSortBy`, type: `string`, default: `—`, description: `Field name to sort by on first fetch.` },
    { name: `defaultSortDirection`, type: `SortDirection`, default: `Ascending`, description: `Sort direction on first fetch.` },
    { name: `displayListHeader`, type: `boolean`, default: `true`, description: `Hide the header bar (row-handler picker / refresh) when false.` },
    { name: `listHeaderElement`, type: `JSX.Element`, default: `—`, description: `Custom content rendered inside the header bar.` },
    { name: `overscanCount`, type: `number`, default: `20`, description: `Number of items rendered outside the visible window for smoother scrolling.` },
    { name: `handlers`, type: `ResourceListHandlers<T>`, default: `—`, description: `Optional event-handler bag (onSelectionChange, onItemActivate, etc.).` },
    { name: `dropTargetAcceptsTypes`, type: `string[]`, default: `—`, description: `Drag-and-drop: which payload types the list accepts as a drop target.` },
    { name: `displayDebugBar`, type: `boolean`, default: `false`, description: `Show an internal debug bar with the current fetch / window state.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) throw new Error(`<ResourceListDocPage> must be rendered inside <MowsProvider>`);
    return ctx.t.example.examples.resourceList;
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

const TEST_FILE = `lib/components/list/ResourceList/ResourceList.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.callsFetcher, testFile: TEST_FILE, testName: `calls getResourcesList on mount`, testLine: 104 },
    { statement: statements.firstWindow, testFile: TEST_FILE, testName: `first fetch passes fromIndex=0 + a finite limit`, testLine: 113 },
    { statement: statements.forwardsSort, testFile: TEST_FILE, testName: `forwards a sortBy + sortDirection in the request body`, testLine: 126 }
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
