import { useContext, useMemo, useState } from "react";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
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
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface Card extends BaseResource {
    readonly id: string;
    readonly title: string;
}

const LIST_A_ID = `example-cross-list-a`;
const LIST_B_ID = `example-cross-list-b`;
const LIST_C_ID = `example-cross-list-c`;

const seed = (prefix: string, count: number, offset: number): Card[] =>
    Array.from({ length: count }).map((_, i) => ({
        id: `${prefix}-${i + 1 + offset}`,
        title: `${prefix} item ${i + 1}`
    }));

const Example = () => {
    const [listA, setListA] = useState<Card[]>(() => seed(`A`, 4, 0));
    const [listB, setListB] = useState<Card[]>(() => seed(`B`, 4, 0));
    const [listC, setListC] = useState<Card[]>(() => seed(`C`, 4, 0));

    // Each list's window-fetcher closes over its own state slice — the
    // displayed order always tracks the parent array.
    const makeFetcher =
        (data: Card[]) =>
        async (req: ListResourceRequestBody): Promise<ListResourceResponseBody<Card>> => ({
            items: data.slice(req.fromIndex, req.fromIndex + req.limit),
            totalCount: data.length
        });

    const handlers = useMemo(() => {
        const columns: Column<Card>[] = [
            {
                field: `title`,
                label: `Title`,
                direction: SortDirection.Neutral,
                widthPercent: 100,
                minWidthPixels: 100,
                enabled: true,
                disableSorting: true,
                render: (item) => <span className={`font-medium`}>{item.title}</span>
            }
        ];
        return [
            new ColumnListRowHandler<Card>({
                columns,
                hideSelectionCheckboxColumn: true,
                hideColumnPicker: true,
                hideColumnHeader: true
            })
        ];
    }, []);

    // Generic reorder applier — moves the `fromIndices` block to
    // start at `toIndex` inside the given list array.
    const applyReorder = (arr: Card[], fromIndices: number[], toIndex: number): Card[] => {
        const sorted = [...fromIndices].sort((a, b) => a - b);
        const moved = sorted.map((i) => arr[i]!);
        const next = arr.slice();
        for (let i = sorted.length - 1; i >= 0; i--) next.splice(sorted[i]!, 1);
        next.splice(toIndex, 0, ...moved);
        return next;
    };

    const removeIndices = (arr: Card[], indices: number[]): Card[] => {
        const sorted = [...indices].sort((a, b) => a - b);
        const next = arr.slice();
        for (let i = sorted.length - 1; i >= 0; i--) next.splice(sorted[i]!, 1);
        return next;
    };

    const insertAt = (arr: Card[], items: Card[], at: number): Card[] => {
        const next = arr.slice();
        next.splice(at, 0, ...items);
        return next;
    };

    useExampleState({
        listA: listA.map((c) => c.id),
        listB: listB.map((c) => c.id),
        listC: listC.map((c) => c.id)
    });

    return (
        <div className={`flex flex-col gap-3`}>
            <p className={`text-muted-foreground text-sm`}>
                Three lists. <span className={`text-foreground font-medium`}>A ↔ B</span> accept
                each other's drops; <span className={`text-foreground font-medium`}>C</span>{` `}
                rejects everything. Start a drag in any list — the others light up to show whether
                they'll accept it (primary outline = accept, dimmed overlay = reject). All three
                still allow internal reordering.
            </p>
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-3`}>
                {[
                    { id: LIST_A_ID, label: `List A`, data: listA, setter: setListA },
                    { id: LIST_B_ID, label: `List B`, data: listB, setter: setListB },
                    { id: LIST_C_ID, label: `List C`, data: listC, setter: setListC }
                ].map(({ id, label, data, setter }) => {
                    const acceptsFrom =
                        id === LIST_A_ID ? [LIST_B_ID]
                        : id === LIST_B_ID ? [LIST_A_ID]
                        : undefined;
                    return (
                        <div key={id} className={`flex flex-col gap-2`}>
                            <div className={`flex items-baseline justify-between`}>
                                <span className={`font-medium`}>{label}</span>
                                <span className={`text-muted-foreground text-xs`}>
                                    {acceptsFrom
                                        ? `accepts: ${acceptsFrom.join(`, `)}`
                                        : `accepts: (self only)`}
                                </span>
                            </div>
                            <div className={`h-[260px] w-full rounded-md border bg-background`}>
                                <ResourceList<Card>
                                    listInstanceId={id}
                                    resourceType={`card`}
                                    rowHandlers={handlers}
                                    initialRowHandler={handlers[0]!.id}
                                    getResourcesList={makeFetcher(data)}
                                    reorderable
                                    reorderAcceptsFrom={acceptsFrom}
                                    displayListHeader={false}
                                    handlers={{
                                        onReorder: (fromIndices, toIndex) => {
                                            setter((prev) => applyReorder(prev, fromIndices, toIndex));
                                        },
                                        onItemsAccepted: (items, insertBeforeIndex) => {
                                            setter((prev) => insertAt(prev, items, insertBeforeIndex));
                                        },
                                        onItemsMovedOut: (fromIndices) => {
                                            setter((prev) => removeIndices(prev, fromIndices));
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.resourceList.crossListDrag,
    Example
};

export default module;
