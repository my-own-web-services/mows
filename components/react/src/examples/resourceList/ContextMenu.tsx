import { useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import ResourceList from "../../../lib/components/list/ResourceList/ResourceList";
import ColumnListRowHandler, { type Column } from "../../../lib/components/list/ResourceList/rowHandlers/Column";
import {
    type BaseResource,
    type ListResourceRequestBody,
    type ListResourceResponseBody,
    SortDirection
} from "../../../lib/components/list/ResourceList/ResourceListTypes";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../../../lib/components/ui/dropdown-menu";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface Repo extends BaseResource {
    readonly id: string;
    readonly name: string;
    readonly owner: string;
    readonly stars: number;
}

const OWNERS = [`acme`, `globex`, `initech`, `umbrella`, `wayne`];

const SEED_REPOS: Repo[] = Array.from({ length: 80 }).map((_, i) => ({
    id: `repo-${(i + 1).toString().padStart(3, `0`)}`,
    name: `repo-${i + 1}`,
    owner: OWNERS[i % OWNERS.length]!,
    stars: ((i * 53) % 8000) + 17
}));

interface MenuState {
    readonly item: Repo;
    readonly x: number;
    readonly y: number;
}

const Example = () => {
    const [repos, setRepos] = useState<ReadonlyArray<Repo>>(SEED_REPOS);
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [lastAction, setLastAction] = useState<string | null>(null);
    const listRef = useRef<ResourceList<Repo>>(null);

    const closeMenu = () => setMenu(null);

    const runAction = (action: `open` | `duplicate` | `delete`) => {
        if (!menu) return;
        const { item } = menu;
        setLastAction(`${action}: ${item.name}`);
        if (action === `delete`) {
            setRepos((prev) => prev.filter((r) => r.id !== item.id));
            // refreshList re-runs getResourcesList against the new fixture
            // so the deleted row actually disappears from the rendered
            // window. Without this the list keeps the stale snapshot it
            // captured at mount.
            listRef.current?.refreshList();
        } else if (action === `duplicate`) {
            setRepos((prev) => {
                const idx = prev.findIndex((r) => r.id === item.id);
                if (idx < 0) return prev;
                const copy: Repo = {
                    ...item,
                    id: `${item.id}-copy-${Date.now().toString(36)}`,
                    name: `${item.name}-copy`
                };
                const next = [...prev];
                next.splice(idx + 1, 0, copy);
                return next;
            });
            listRef.current?.refreshList();
        }
        closeMenu();
    };

    const handlers = useMemo(() => {
        const columns: Column<Repo>[] = [
            {
                field: `name`,
                label: `Repository`,
                direction: SortDirection.Ascending,
                widthPercent: 45,
                minWidthPixels: 160,
                enabled: true,
                render: (item) => <span className={`font-medium`}>{item.name}</span>
            },
            {
                field: `owner`,
                label: `Owner`,
                direction: SortDirection.Neutral,
                widthPercent: 30,
                minWidthPixels: 120,
                enabled: true,
                render: (item) => <span className={`text-muted-foreground`}>{item.owner}</span>
            },
            {
                field: `stars`,
                label: `Stars`,
                direction: SortDirection.Neutral,
                widthPercent: 25,
                minWidthPixels: 90,
                enabled: true,
                render: (item) => (
                    <span className={`tabular-nums`}>{item.stars.toLocaleString()}</span>
                )
            }
        ];
        return [
            new ColumnListRowHandler<Repo>({
                columns,
                hideSelectionCheckboxColumn: true
            })
        ];
    }, []);

    const getResourcesList = async (
        req: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<Repo>> => ({
        items: repos.slice(req.fromIndex, req.fromIndex + req.limit),
        totalCount: repos.length
    });

    useExampleState({
        menuOpen: menu !== null,
        rightClickedId: menu?.item.id ?? null,
        lastAction,
        remainingCount: repos.length
    });

    return (
        <div className={`flex flex-col gap-3`}>
            <p className={`text-muted-foreground text-sm`}>
                Right-click anywhere on a row to open the action menu. Delete removes the row;
                duplicate inserts a copy right below it.
            </p>
            <div className={`h-[420px] w-full rounded-md border bg-background`}>
                <ResourceList<Repo>
                    ref={listRef}
                    listInstanceId={`example-resource-list-contextmenu`}
                    resourceType={`repo`}
                    rowHandlers={handlers}
                    initialRowHandler={handlers[0]!.id}
                    getResourcesList={getResourcesList}
                    defaultSortBy={`name`}
                    defaultSortDirection={SortDirection.Ascending}
                    handlers={{
                        onItemRightClick: (item, event) => {
                            event.preventDefault();
                            const mouseEvent = event as React.MouseEvent<HTMLDivElement>;
                            setMenu({ item, x: mouseEvent.clientX, y: mouseEvent.clientY });
                        }
                    }}
                />
            </div>
            <DropdownMenu
                modal={false}
                open={menu !== null}
                onOpenChange={(open) => {
                    if (!open) closeMenu();
                }}
            >
                {menu !== null && (
                    <DropdownMenuTrigger asChild>
                        <span
                            aria-hidden
                            style={{
                                position: `fixed`,
                                left: menu.x,
                                top: menu.y,
                                display: `block`,
                                width: 0,
                                height: 0
                            }}
                        />
                    </DropdownMenuTrigger>
                )}
                <DropdownMenuContent align={`start`} side={`bottom`} sideOffset={0}>
                    <DropdownMenuLabel className={`text-muted-foreground text-xs`}>
                        {menu?.item.name ?? `—`}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => runAction(`open`)}>
                        <ExternalLink className={`mr-2 h-4 w-4`} /> Open
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => runAction(`duplicate`)}>
                        <Copy className={`mr-2 h-4 w-4`} /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={() => runAction(`delete`)}
                        className={`text-destructive focus:text-destructive`}
                    >
                        <Trash2 className={`mr-2 h-4 w-4`} /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.resourceList.contextMenu,
    Example
};

export default module;
