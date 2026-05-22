import { useMemo } from "react";
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

interface Deployment extends BaseResource {
    readonly id: string;
    readonly name: string;
    readonly region: string;
    readonly status: `healthy` | `degraded` | `offline`;
    readonly latencyMs: number;
}

const REGIONS = [`eu-west-1`, `eu-central-1`, `us-east-1`, `us-west-2`, `ap-south-1`];
const STATUSES: Deployment[`status`][] = [`healthy`, `healthy`, `healthy`, `degraded`, `offline`];

// Deterministic 600-row fixture — concrete enough to show off four real
// column types (text, region, status badge, numeric) without pulling in a
// real backend.
const DEPLOYMENTS: Deployment[] = Array.from({ length: 600 }).map((_, i) => ({
    id: `dep-${(i + 1).toString().padStart(4, `0`)}`,
    name: `service-${(i + 1).toString().padStart(3, `0`)}`,
    region: REGIONS[i % REGIONS.length]!,
    status: STATUSES[i % STATUSES.length]!,
    latencyMs: 12 + ((i * 37) % 240)
}));

const STATUS_CLASS: Record<Deployment[`status`], string> = {
    healthy: `bg-emerald-500/15 text-emerald-600 dark:text-emerald-400`,
    degraded: `bg-amber-500/15 text-amber-600 dark:text-amber-400`,
    offline: `bg-destructive/15 text-destructive`
};

const compareBy = (a: Deployment, b: Deployment, field: string): number => {
    const av = a[field];
    const bv = b[field];
    if (typeof av === `number` && typeof bv === `number`) return av - bv;
    return String(av).localeCompare(String(bv));
};

const Example = () => {
    const handlers = useMemo(() => {
        const columns: Column<Deployment>[] = [
            {
                field: `name`,
                label: `Name`,
                direction: SortDirection.Ascending,
                widthPercent: 35,
                minWidthPixels: 140,
                enabled: true,
                render: (item) => <span className={`font-medium`}>{item.name}</span>
            },
            {
                field: `region`,
                label: `Region`,
                direction: SortDirection.Neutral,
                widthPercent: 25,
                minWidthPixels: 120,
                enabled: true,
                render: (item) => (
                    <span className={`text-muted-foreground tabular-nums`}>{item.region}</span>
                )
            },
            {
                field: `status`,
                label: `Status`,
                direction: SortDirection.Neutral,
                widthPercent: 20,
                minWidthPixels: 100,
                enabled: true,
                render: (item) => (
                    <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[item.status]}`}
                    >
                        {item.status}
                    </span>
                )
            },
            {
                field: `latencyMs`,
                label: `Latency`,
                direction: SortDirection.Neutral,
                widthPercent: 20,
                minWidthPixels: 90,
                enabled: true,
                render: (item) => <span className={`tabular-nums`}>{item.latencyMs} ms</span>
            }
        ];
        return [new ColumnListRowHandler<Deployment>({ columns })];
    }, []);

    const getResourcesList = async (
        req: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<Deployment>> => {
        const sorted = [...DEPLOYMENTS].sort((a, b) => {
            const cmp = compareBy(a, b, req.sortBy);
            return req.sortDirection === SortDirection.Descending ? -cmp : cmp;
        });
        const slice = sorted.slice(req.fromIndex, req.fromIndex + req.limit);
        return { items: slice, totalCount: DEPLOYMENTS.length };
    };

    useExampleState({ totalItems: DEPLOYMENTS.length });

    return (
        <div className={`h-[480px] w-full rounded-md border bg-background`}>
            <ResourceList<Deployment>
                listInstanceId={`example-resource-list-default`}
                resourceType={`deployment`}
                rowHandlers={handlers}
                initialRowHandler={handlers[0]!.id}
                getResourcesList={getResourcesList}
                defaultSortBy={`name`}
                defaultSortDirection={SortDirection.Ascending}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.resourceList.default,
    Example
};

export default module;
