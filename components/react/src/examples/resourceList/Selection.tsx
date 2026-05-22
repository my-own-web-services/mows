import { useMemo, useState } from "react";
import ResourceList from "../../../lib/components/list/ResourceList/ResourceList";
import ColumnListRowHandler, { type Column } from "../../../lib/components/list/ResourceList/rowHandlers/Column";
import {
    type BaseResource,
    type ListResourceRequestBody,
    type ListResourceResponseBody,
    SortDirection
} from "../../../lib/components/list/ResourceList/ResourceListTypes";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface Task extends BaseResource {
    readonly id: string;
    readonly title: string;
    readonly assignee: string;
    readonly priority: `low` | `normal` | `high` | `urgent`;
}

const PRIORITIES: Task[`priority`][] = [`low`, `normal`, `normal`, `high`, `urgent`];
const ASSIGNEES = [`alex`, `jordan`, `riley`, `morgan`, `sam`];

const TASKS: Task[] = Array.from({ length: 120 }).map((_, i) => ({
    id: `task-${(i + 1).toString().padStart(3, `0`)}`,
    title: `Ticket #${i + 1}`,
    assignee: ASSIGNEES[i % ASSIGNEES.length]!,
    priority: PRIORITIES[i % PRIORITIES.length]!
}));

const PRIORITY_CLASS: Record<Task[`priority`], string> = {
    low: `text-muted-foreground`,
    normal: ``,
    high: `text-amber-600 dark:text-amber-400`,
    urgent: `text-destructive font-semibold`
};

const Example = () => {
    const [selectedCount, setSelectedCount] = useState(0);
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    const handlers = useMemo(() => {
        const columns: Column<Task>[] = [
            {
                field: `title`,
                label: `Title`,
                direction: SortDirection.Ascending,
                widthPercent: 45,
                minWidthPixels: 140,
                enabled: true,
                render: (item) => <span className={`font-medium`}>{item.title}</span>
            },
            {
                field: `assignee`,
                label: `Assignee`,
                direction: SortDirection.Neutral,
                widthPercent: 30,
                minWidthPixels: 120,
                enabled: true,
                render: (item) => <span className={`text-muted-foreground`}>{item.assignee}</span>
            },
            {
                field: `priority`,
                label: `Priority`,
                direction: SortDirection.Neutral,
                widthPercent: 25,
                minWidthPixels: 100,
                enabled: true,
                render: (item) => (
                    <span className={`capitalize ${PRIORITY_CLASS[item.priority]}`}>
                        {item.priority}
                    </span>
                )
            }
        ];
        return [new ColumnListRowHandler<Task>({ columns, selectAllTitle: `Select all tasks` })];
    }, []);

    const getResourcesList = async (
        _req: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<Task>> => ({
        items: TASKS.slice(_req.fromIndex, _req.fromIndex + _req.limit),
        totalCount: TASKS.length
    });

    useExampleState({ selectedCount, lastSelectedId, totalItems: TASKS.length });

    return (
        <div className={`flex flex-col gap-3`}>
            <div className={`text-muted-foreground flex items-center gap-4 text-sm`}>
                <span>
                    Selected: <span className={`text-foreground font-medium tabular-nums`}>{selectedCount}</span>
                </span>
                <span>
                    Last: <span className={`text-foreground font-medium`}>{lastSelectedId ?? `–`}</span>
                </span>
            </div>
            <div className={`h-[420px] w-full rounded-md border bg-background`}>
                <ResourceList<Task>
                    listInstanceId={`example-resource-list-selection`}
                    resourceType={`task`}
                    rowHandlers={handlers}
                    initialRowHandler={handlers[0]!.id}
                    getResourcesList={getResourcesList}
                    defaultSortBy={`title`}
                    defaultSortDirection={SortDirection.Ascending}
                    handlers={{
                        onSelect: (items, last) => {
                            setSelectedCount(items.length);
                            setLastSelectedId(last?.id ?? null);
                        }
                    }}
                />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.resourceList.selection,
    Example
};

export default module;
