import { useEffect, useMemo, useRef, useState } from "react";
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

    // If the right-clicked row is part of the current multi-selection,
    // the action targets every selected row. Otherwise — right-click on
    // an unselected row — only that row is affected. This mirrors how
    // OS file managers handle right-click in a multi-selection.
    const resolveTargets = (anchor: Repo): ReadonlyArray<Repo> => {
        const selected = listRef.current?.getSelectedItems() ?? [];
        const selectedIds = new Set(selected.map((r) => r.id));
        if (selectedIds.has(anchor.id) && selected.length > 0) return selected;
        return [anchor];
    };

    const runAction = (action: `open` | `duplicate` | `delete`) => {
        if (!menu) return;
        const targets = resolveTargets(menu.item);
        setLastAction(`${action}: ${targets.map((t) => t.name).join(`, `)}`);
        if (action === `delete`) {
            const ids = new Set(targets.map((t) => t.id));
            setRepos((prev) => prev.filter((r) => !ids.has(r.id)));
        } else if (action === `duplicate`) {
            const targetIds = new Set(targets.map((t) => t.id));
            const stamp = Date.now().toString(36);
            setRepos((prev) => {
                const next: Repo[] = [];
                prev.forEach((r) => {
                    next.push(r);
                    if (targetIds.has(r.id)) {
                        next.push({
                            ...r,
                            id: `${r.id}-copy-${stamp}`,
                            name: `${r.name}-copy`
                        });
                    }
                });
                return next;
            });
        }
        closeMenu();
    };

    // refreshList lives in an effect — not inline next to setRepos — so it
    // runs *after* ResourceList has received the new getResourcesList prop
    // closure. Calling it synchronously inside the same handler would
    // re-fetch through the previous-render closure (still the old `repos`).
    const isFirstRenderRef = useRef(true);
    useEffect(() => {
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return;
        }
        listRef.current?.refreshList();
    }, [repos]);

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
    ): Promise<ListResourceResponseBody<Repo>> => {
        const sorted = [...repos].sort((a, b) => {
            const av = a[req.sortBy as keyof Repo];
            const bv = b[req.sortBy as keyof Repo];
            const cmp =
                typeof av === `number` && typeof bv === `number`
                    ? av - bv
                    : String(av).localeCompare(String(bv));
            return req.sortDirection === SortDirection.Descending ? -cmp : cmp;
        });
        return {
            items: sorted.slice(req.fromIndex, req.fromIndex + req.limit),
            totalCount: sorted.length
        };
    };

    useExampleState({
        menuOpen: menu !== null,
        rightClickedId: menu?.item.id ?? null,
        lastAction,
        remainingCount: repos.length
    });

    return (
        <div className={`flex flex-col gap-3`}>
            <p className={`text-muted-foreground text-sm`}>
                Right-click anywhere on a row to open the action menu. Ctrl/Cmd-click or
                Shift-click to multi-select; right-clicking any selected row then deletes (or
                duplicates) every selected row at once.
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
