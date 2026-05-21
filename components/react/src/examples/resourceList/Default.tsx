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

interface Item extends BaseResource {
    readonly id: string;
    readonly name: string;
    readonly size: number;
}

const ITEMS: Item[] = Array.from({ length: 250 }).map((_, i) => ({
    id: `${i + 1}`,
    name: `Resource ${i + 1}`,
    size: ((i + 1) * 137) % 4096
}));

const Example = () => {
    const handlers = useMemo(() => {
        const columns: Column<Item>[] = [
            {
                field: `name`,
                label: `Name`,
                direction: SortDirection.Ascending,
                widthPercent: 70,
                minWidthPixels: 120,
                enabled: true,
                render: (item) => <span>{item.name}</span>
            },
            {
                field: `size`,
                label: `Size`,
                direction: SortDirection.Ascending,
                widthPercent: 30,
                minWidthPixels: 80,
                enabled: true,
                render: (item) => <span className={`tabular-nums`}>{item.size} B</span>
            }
        ];
        return [new ColumnListRowHandler<Item>({ columns })];
    }, []);

    const getResourcesList = async (
        req: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<Item>> => {
        const slice = ITEMS.slice(req.fromIndex, req.fromIndex + req.limit);
        const sorted =
            req.sortDirection === SortDirection.Descending ? [...slice].reverse() : slice;
        return { items: sorted, totalCount: ITEMS.length };
    };

    useExampleState({ totalItems: ITEMS.length });

    return (
        <div className={`h-[480px] w-full rounded-md border bg-background`}>
            <ResourceList<Item>
                listInstanceId={`example-resource-list`}
                resourceType={`example-item`}
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
