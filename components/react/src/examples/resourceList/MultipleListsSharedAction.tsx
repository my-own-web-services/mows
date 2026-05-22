import { useEffect, useMemo, useRef, useState } from "react";
import ResourceList from "../../../lib/components/list/ResourceList/ResourceList";
import ColumnListRowHandler, {
    type Column
} from "../../../lib/components/list/ResourceList/rowHandlers/Column";
import {
    type BaseResource,
    type ListResourceRequestBody,
    type ListResourceResponseBody,
    SortDirection
} from "../../../lib/components/list/ResourceList/ResourceListTypes";
import {
    EXAMPLE_REPO_LIST_ITEM_SCOPE,
    registerRepoDeleteSink
} from "../../exampleActions";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface Repo extends BaseResource {
    readonly id: string;
    readonly name: string;
    readonly owner: string;
}

const SERVER_REPOS: Repo[] = Array.from({ length: 24 }).map((_, i) => ({
    id: `srv-${(i + 1).toString().padStart(3, `0`)}`,
    name: `server-${i + 1}`,
    owner: [`acme`, `globex`, `initech`][i % 3]!
}));

const DATABASE_REPOS: Repo[] = Array.from({ length: 24 }).map((_, i) => ({
    id: `db-${(i + 1).toString().padStart(3, `0`)}`,
    name: `db-${i + 1}`,
    owner: [`acme`, `wayne`, `umbrella`][i % 3]!
}));

const SERVERS_LIST_ID = `example-shared-action-servers`;
const DATABASES_LIST_ID = `example-shared-action-databases`;

interface RepoListProps {
    readonly listId: string;
    readonly title: string;
    readonly items: ReadonlyArray<Repo>;
    readonly listRef: React.Ref<ResourceList<Repo>>;
}

const RepoList = ({ listId, title, items, listRef }: RepoListProps) => {
    const handlers = useMemo(() => {
        const columns: Column<Repo>[] = [
            {
                field: `name`,
                label: `Name`,
                direction: SortDirection.Ascending,
                widthPercent: 55,
                minWidthPixels: 140,
                enabled: true,
                render: (item) => <span className={`font-medium`}>{item.name}</span>
            },
            {
                field: `owner`,
                label: `Owner`,
                direction: SortDirection.Neutral,
                widthPercent: 45,
                minWidthPixels: 100,
                enabled: true,
                render: (item) => <span className={`text-muted-foreground`}>{item.owner}</span>
            }
        ];
        return [
            new ColumnListRowHandler<Repo>({
                columns,
                hideSelectionCheckboxColumn: true,
                // Stamp the row's outer <div> with the attributes
                // GlobalContextMenu + the shared RepoDelete handler read
                // off the right-clicked element. Putting them on the row
                // (not on an inner cell) is what makes right-clicks
                // *anywhere* in the row fire the shared action.
                rowAttributes: (item) => ({
                    "data-actionscope": EXAMPLE_REPO_LIST_ITEM_SCOPE,
                    "data-list-id": listId,
                    "data-item-id": item.id
                })
            })
        ];
    }, [listId]);

    const getResourcesList = async (
        req: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<Repo>> => ({
        items: items.slice(req.fromIndex, req.fromIndex + req.limit),
        totalCount: items.length
    });

    return (
        <div className={`flex min-h-0 flex-1 flex-col gap-2`}>
            <h4 className={`text-sm font-semibold`}>
                {title}{` `}
                <span className={`text-muted-foreground font-normal`}>({items.length})</span>
            </h4>
            <div className={`h-[360px] rounded-md border bg-background`}>
                <ResourceList<Repo>
                    ref={listRef}
                    listInstanceId={listId}
                    resourceType={`repo`}
                    rowHandlers={handlers}
                    initialRowHandler={handlers[0]!.id}
                    getResourcesList={getResourcesList}
                    defaultSortBy={`name`}
                    defaultSortDirection={SortDirection.Ascending}
                />
            </div>
        </div>
    );
};

const Example = () => {
    const [servers, setServers] = useState<ReadonlyArray<Repo>>(SERVER_REPOS);
    const [databases, setDatabases] = useState<ReadonlyArray<Repo>>(DATABASE_REPOS);
    const [lastDeleted, setLastDeleted] = useState<{
        readonly listId: string;
        readonly itemId: string;
    } | null>(null);

    const serversRef = useRef<ResourceList<Repo>>(null);
    const databasesRef = useRef<ResourceList<Repo>>(null);

    useEffect(() => {
        const deleteFromServers = (itemId: string) => {
            setServers((prev) => prev.filter((r) => r.id !== itemId));
            setLastDeleted({ listId: SERVERS_LIST_ID, itemId });
            // The ResourceList only re-runs getResourcesList on demand —
            // refreshList drops the cached window so the deleted row
            // disappears immediately.
            serversRef.current?.refreshList();
        };
        const deleteFromDatabases = (itemId: string) => {
            setDatabases((prev) => prev.filter((r) => r.id !== itemId));
            setLastDeleted({ listId: DATABASES_LIST_ID, itemId });
            databasesRef.current?.refreshList();
        };
        const unsubServers = registerRepoDeleteSink(SERVERS_LIST_ID, deleteFromServers);
        const unsubDatabases = registerRepoDeleteSink(DATABASES_LIST_ID, deleteFromDatabases);
        return () => {
            unsubServers();
            unsubDatabases();
        };
    }, []);

    useExampleState({
        servers: servers.length,
        databases: databases.length,
        lastDeleted
    });

    return (
        <div className={`flex flex-col gap-3`}>
            <p className={`text-muted-foreground text-sm`}>
                Right-click any row in either list — the same Delete action removes from the
                correct list because the handler walks up the DOM to read{` `}
                <code>data-list-id</code> + <code>data-item-id</code> off the row.
            </p>
            <div className={`flex flex-col gap-4 md:flex-row`}>
                <RepoList
                    listId={SERVERS_LIST_ID}
                    title={`Servers`}
                    items={servers}
                    listRef={serversRef}
                />
                <RepoList
                    listId={DATABASES_LIST_ID}
                    title={`Databases`}
                    items={databases}
                    listRef={databasesRef}
                />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.resourceList.multipleListsSharedAction,
    Example
};

export default module;
