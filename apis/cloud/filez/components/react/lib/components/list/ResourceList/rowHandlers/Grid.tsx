import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { SortDirection } from "filez-client-typescript";
import { CSSProperties, JSX } from "react";
import { BsFillGridFill } from "react-icons/bs";
import ResourceList from "../ResourceList";
import {
    BaseResource,
    ListRowHandler,
    LoadItemMode,
    RowComponentProps,
    RowRendererDirection,
    SelectedItemsAfterKeypress
} from "../ResourceListTypes";

export interface GridListRowHandlerProps<FilezResourceType> {
    hideCheckboxSelection?: boolean;
    defaultGridColumnCount?: number;
}

export default class GridListRowHandler<FilezResourceType extends BaseResource>
    implements ListRowHandler<FilezResourceType>
{
    id = "GridListRowHandler";
    name = "Grid";
    icon = (<BsFillGridFill height={"100%"} />);
    direction = RowRendererDirection.Vertical;
    resourceList: InstanceType<typeof ResourceList> | undefined;
    rowHeight = 24;
    gridColumnCount: number;

    props: GridListRowHandlerProps<FilezResourceType>;

    constructor(props: GridListRowHandlerProps<FilezResourceType>) {
        this.props = props;
        this.gridColumnCount = props.defaultGridColumnCount ?? 10;
    }

    getMinimumBatchSize = (totalCount: number): number => {
        return 50;
    };

    getLoadMoreItemsThreshold = (totalCount: number): number => {
        return 20;
    };

    setSorting = (field: string, newDirection: SortDirection) => {
        this.resourceList?.setState(
            {
                sortBy: field,
                sortDirection: newDirection
            },
            () => {
                this.resourceList?.loadItems(LoadItemMode.Reload);
                this.resourceList?.forceUpdate();
            }
        );
    };

    headerRenderer = () => {
        return (
            <div
                className="relative flex h-8 justify-end border-t-1 border-b-1"
                style={{ width: `calc(100% - 17px)` }}
            >
                <Slider
                    className="w-52"
                    defaultValue={[this.gridColumnCount]}
                    max={50}
                    min={1}
                    step={1}
                    onValueChange={(value) => {
                        this.gridColumnCount = value[0];

                        this.resourceList?.forceUpdate();
                    }}
                ></Slider>
            </div>
        );
    };

    rowRenderer = (rowProps: RowComponentProps<FilezResourceType>) => {
        if (rowProps.data === undefined) return;
        const { index, style, data } = rowProps;

        const { items: allItems, handlers, total_count } = rowProps.data;

        const { onItemClick } = handlers;
        const gridColumnCount = this.gridColumnCount;
        const startIndex = index * gridColumnCount;
        const endIndex = startIndex + gridColumnCount;
        const rowItems = allItems.slice(startIndex, endIndex);

        return (
            <div className={cn("GridRow")} style={{ ...style }}>
                {rowItems.map((item, i) => {
                    const actualListIndex = index * gridColumnCount + i;

                    if (actualListIndex >= total_count) return;
                    if (item === undefined) return;

                    const isSelected = data.selectedItems[actualListIndex] === true;

                    const isLastSelected = actualListIndex === data.lastSelectedItemIndex;

                    const key = "GridRowItem" + actualListIndex;
                    return (
                        <div
                            onClick={(e) => onItemClick?.(e, item, actualListIndex)}
                            onContextMenu={(e) => {
                                onItemClick?.(e, item, actualListIndex, true);
                            }}
                            className={cn(
                                "GridRowItem",
                                isSelected && "bg-secondary/60",
                                isLastSelected && "bg-secondary/100",
                                "float-left h-full cursor-default overflow-hidden p-2 text-ellipsis outline-1 select-none"
                            )}
                            style={{
                                width: `calc(100% / ${gridColumnCount})`
                            }}
                            key={key}
                        >
                            {item.name}
                        </div>
                    );
                })}
            </div>
        );
    };

    getRowCount = (itemCount: number): number => {
        return Math.ceil(itemCount / this.gridColumnCount);
    };
    getRowHeight = (width: number, _height: number): number => {
        return width / this.gridColumnCount;
    };
    getItemKey = (_items: (FilezResourceType | undefined)[], index: number): number => {
        return index * this.gridColumnCount;
    };
    isItemLoaded = (items: (FilezResourceType | undefined)[], rowIndex: number): boolean => {
        const startIndex = rowIndex * this.gridColumnCount;
        const endIndex = startIndex + this.gridColumnCount;

        return (
            items.filter((item, i) => i >= startIndex && i < endIndex && item !== undefined)
                .length === this.gridColumnCount
        );
    };
    getStartIndexAndLimit = (
        startIndex: number,
        limit: number
    ): { startIndex: number; limit: number } => {
        return {
            startIndex: startIndex * this.gridColumnCount,
            limit: limit * this.gridColumnCount
        };
    };
    getSelectedItemsAfterKeypress = (
        e: React.KeyboardEvent<HTMLDivElement>,
        _items: (FilezResourceType | undefined)[],
        total_count: number,
        selectedItems: (boolean | undefined)[],
        lastSelectedItemIndex: number | undefined,
        arrowKeyShiftSelectItemIndex: number | undefined
    ) => {
        const keyOptions = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
        if (keyOptions.includes(e.key)) {
            // if no item is selected select the first one

            const def: SelectedItemsAfterKeypress = {
                scrollToRowIndex: 0,
                nextSelectedItemIndex: 0
            };

            if (Object.keys(selectedItems).length === 0) {
                return def;
            } else {
                if (lastSelectedItemIndex === undefined) {
                    return def;
                }

                const lastItemIndex = total_count - 1;

                const newItemIndex = (() => {
                    if (e.key === "ArrowUp") {
                        const mb = lastSelectedItemIndex - this.gridColumnCount;

                        return mb > 0
                            ? mb
                            : lastItemIndex -
                                  (lastItemIndex % this.gridColumnCount) +
                                  (lastSelectedItemIndex % this.gridColumnCount);
                    } else if (e.key === "ArrowDown") {
                        const mb = lastSelectedItemIndex + this.gridColumnCount;
                        return mb < lastItemIndex
                            ? mb
                            : 0 + (lastSelectedItemIndex % this.gridColumnCount);
                    } else if (e.key === "ArrowLeft") {
                        const mb = lastSelectedItemIndex - 1;
                        return mb >= 0 ? mb : lastItemIndex;
                    } else if (e.key === "ArrowRight") {
                        const mb = lastSelectedItemIndex + 1;
                        return mb <= lastItemIndex ? mb : 0;
                    } else {
                        return lastSelectedItemIndex;
                    }
                })();

                const newRowIndex = Math.floor(newItemIndex / this.gridColumnCount);
                const lastRowIndex = Math.floor(lastSelectedItemIndex / this.gridColumnCount);

                return {
                    nextSelectedItemIndex: newItemIndex,
                    scrollToRowIndex: newRowIndex === lastRowIndex ? undefined : newRowIndex,
                    arrowKeyShiftSelectItemIndex: (() => {
                        if (e.shiftKey) {
                            if (arrowKeyShiftSelectItemIndex === undefined) {
                                return lastSelectedItemIndex;
                            }
                            return arrowKeyShiftSelectItemIndex;
                        } else {
                            return undefined;
                        }
                    })()
                };
            }
        }
    };
}

export interface Column<FilezResourceType> {
    field: string;
    alternateField?: string;
    label: string;
    direction: SortDirection;
    widthPercent: number;
    minWidthPixels: number;
    enabled: boolean;
    render: (item: FilezResourceType, style: CSSProperties, className: string) => JSX.Element;
}
