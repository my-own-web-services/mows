import { useMemo } from "react";
import ResourceList from "../../../lib/components/list/ResourceList/ResourceList";
import GridListRowHandler from "../../../lib/components/list/ResourceList/rowHandlers/Grid";
import {
    type BaseResource,
    type ListResourceRequestBody,
    type ListResourceResponseBody,
    SortDirection
} from "../../../lib/components/list/ResourceList/ResourceListTypes";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface Swatch extends BaseResource {
    readonly id: string;
    readonly hue: number;
    readonly name: string;
}

// A 360-row colour palette — one swatch per degree of hue. Each cell becomes
// a square tile in the grid, so the same component that drives a column
// table also drives a gallery view by swapping the row handler.
const SWATCHES: Swatch[] = Array.from({ length: 360 }).map((_, i) => ({
    id: `hue-${i.toString().padStart(3, `0`)}`,
    hue: i,
    name: `H${i}°`
}));

const Example = () => {
    const handlers = useMemo(
        () => [
            new GridListRowHandler<Swatch>({
                defaultGridColumnCount: 10,
                hideCheckboxSelection: true,
                cellRenderer: (item) => (
                    <div
                        className={`flex h-full w-full flex-col items-center justify-center rounded-sm text-xs font-medium text-white/90 mix-blend-difference`}
                        style={{ backgroundColor: `hsl(${item.hue}, 70%, 55%)` }}
                    >
                        <span>{item.name}</span>
                    </div>
                )
            })
        ],
        []
    );

    const getResourcesList = async (
        req: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<Swatch>> => {
        const slice = SWATCHES.slice(req.fromIndex, req.fromIndex + req.limit);
        return { items: slice, totalCount: SWATCHES.length };
    };

    useExampleState({ totalItems: SWATCHES.length });

    return (
        <div className={`h-[480px] w-full rounded-md border bg-background`}>
            <ResourceList<Swatch>
                listInstanceId={`example-resource-list-grid`}
                resourceType={`swatch`}
                rowHandlers={handlers}
                initialRowHandler={handlers[0]!.id}
                getResourcesList={getResourcesList}
                defaultSortBy={`hue`}
                defaultSortDirection={SortDirection.Ascending}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.resourceList.grid,
    Example
};

export default module;
