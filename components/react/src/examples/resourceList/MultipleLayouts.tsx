import { useMemo } from "react";
import ResourceList from "../../../lib/components/list/ResourceList/ResourceList";
import ColumnListRowHandler, { type Column } from "../../../lib/components/list/ResourceList/rowHandlers/Column";
import GridListRowHandler from "../../../lib/components/list/ResourceList/rowHandlers/Grid";
import {
    type BaseResource,
    type ListResourceRequestBody,
    type ListResourceResponseBody,
    SortDirection
} from "../../../lib/components/list/ResourceList/ResourceListTypes";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface Product extends BaseResource {
    readonly id: string;
    readonly sku: string;
    readonly name: string;
    readonly category: string;
    readonly priceCents: number;
}

const CATEGORIES = [`Audio`, `Storage`, `Display`, `Input`, `Network`];

const PRODUCTS: Product[] = Array.from({ length: 400 }).map((_, i) => ({
    id: `prod-${(i + 1).toString().padStart(4, `0`)}`,
    sku: `SKU-${(i + 1).toString().padStart(5, `0`)}`,
    name: `Product ${i + 1}`,
    category: CATEGORIES[i % CATEGORIES.length]!,
    priceCents: 999 + ((i * 173) % 19000)
}));

const formatPrice = (cents: number): string =>
    `$${(cents / 100).toFixed(2)}`;

const compareBy = (a: Product, b: Product, field: string): number => {
    const av = a[field];
    const bv = b[field];
    if (typeof av === `number` && typeof bv === `number`) return av - bv;
    return String(av).localeCompare(String(bv));
};

const Example = () => {
    const handlers = useMemo(() => {
        const columns: Column<Product>[] = [
            {
                field: `sku`,
                label: `SKU`,
                direction: SortDirection.Neutral,
                widthPercent: 25,
                minWidthPixels: 110,
                enabled: true,
                render: (item) => <span className={`text-muted-foreground tabular-nums`}>{item.sku}</span>
            },
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
                field: `category`,
                label: `Category`,
                direction: SortDirection.Neutral,
                widthPercent: 20,
                minWidthPixels: 100,
                enabled: true,
                render: (item) => <span>{item.category}</span>
            },
            {
                field: `priceCents`,
                label: `Price`,
                direction: SortDirection.Neutral,
                widthPercent: 20,
                minWidthPixels: 90,
                enabled: true,
                render: (item) => (
                    <span className={`tabular-nums`}>{formatPrice(item.priceCents)}</span>
                )
            }
        ];

        const columnHandler = new ColumnListRowHandler<Product>({ columns });

        const gridHandler = new GridListRowHandler<Product>({
            defaultGridColumnCount: 6,
            hideCheckboxSelection: true,
            cellRenderer: (item) => (
                <div
                    className={`bg-card flex h-full w-full flex-col items-center justify-center gap-1 rounded-sm border p-2 text-center`}
                >
                    <div
                        className={`bg-secondary flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold`}
                    >
                        {item.category[0]}
                    </div>
                    <span className={`truncate text-xs font-medium`}>{item.name}</span>
                    <span className={`text-muted-foreground tabular-nums text-xs`}>
                        {formatPrice(item.priceCents)}
                    </span>
                </div>
            )
        });

        return [columnHandler, gridHandler];
    }, []);

    const getResourcesList = async (
        req: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<Product>> => {
        const sorted = [...PRODUCTS].sort((a, b) => {
            const cmp = compareBy(a, b, req.sortBy);
            return req.sortDirection === SortDirection.Descending ? -cmp : cmp;
        });
        const slice = sorted.slice(req.fromIndex, req.fromIndex + req.limit);
        return { items: slice, totalCount: PRODUCTS.length };
    };

    useExampleState({ totalItems: PRODUCTS.length, layouts: [`Columns`, `Grid`] });

    return (
        <div className={`h-[480px] w-full rounded-md border bg-background`}>
            <ResourceList<Product>
                listInstanceId={`example-resource-list-multi`}
                resourceType={`product`}
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
    strings: (t) => t.examples.resourceList.multipleLayouts,
    Example
};

export default module;
