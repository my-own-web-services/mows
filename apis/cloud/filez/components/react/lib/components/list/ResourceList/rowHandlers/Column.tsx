import OptionPicker from "@/components/atoms/OptionPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { SortDirection } from "filez-client-typescript";
import { cloneDeep } from "lodash";
import { LucideColumns3 } from "lucide-react";
import { CSSProperties, JSX } from "react";
import { FaThList } from "react-icons/fa";
import { IoChevronUp } from "react-icons/io5";
import { match } from "ts-pattern";
import ResourceList, { getSelectedCount, LoadItemMode } from "../ResourceList";
import {
    BaseResource,
    ListRowHandler,
    RowComponentProps,
    RowRendererDirection,
    SelectedItemsAfterKeypress
} from "../ResourceListTypes";

export interface ColumnListRowHandlerProps<FilezResourceType> {
    columns: Column<FilezResourceType>[];
    checkboxSelectionColumn?: boolean;
}

export default class ColumnListRowHandler<FilezResourceType extends BaseResource>
    implements ListRowHandler<FilezResourceType>
{
    name = "ColumnListRowHandler";
    icon = (<FaThList style={{ transform: "scale(0.9)", pointerEvents: "none" }} size={17} />);
    //component = ColumnRowRenderer;
    direction = RowRendererDirection.Vertical;
    columns: Column<FilezResourceType>[];
    resourceList: InstanceType<typeof ResourceList> | undefined;
    rowHeight = 24;
    props: ColumnListRowHandlerProps<FilezResourceType>;

    constructor(props: ColumnListRowHandlerProps<FilezResourceType>) {
        this.props = props;

        if (props.checkboxSelectionColumn === undefined) {
            this.props.checkboxSelectionColumn = true;
        }

        this.columns = cloneDeep(props.columns);
    }

    setColumSorting = (field: string, newDirection: SortDirection) => {
        this.columns = this.columns.map((c) => {
            if (c.field === field) {
                c.direction = newDirection;
            } else {
                c.direction = SortDirection.Neutral;
            }
            return c;
        });
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
        const columns = this.columns;
        const activeColumns = columns.filter((c) => c.enabled);

        return (
            <div className="relative flex h-8 border-b-1" style={{ width: `calc(100% - 17px)` }}>
                {this.props.checkboxSelectionColumn && (
                    <div className="flex h-full w-8 items-center justify-center">
                        <Checkbox
                            checked={
                                getSelectedCount(this.resourceList?.state.selectedItems) ===
                                    this.resourceList?.state.totalCount &&
                                (this.resourceList?.state.totalCount ?? 0) > 0
                            }
                            onCheckedChange={(checkedState) => {
                                checkedState.valueOf()
                                    ? this.resourceList?.selectAll()
                                    : this.resourceList?.deselectAll();
                            }}
                        ></Checkbox>
                    </div>
                )}
                <ResizablePanelGroup
                    className="group items-center"
                    direction="horizontal"
                    onLayout={(l) => {
                        l.forEach((widthPercent, index) => {
                            const col = activeColumns[index];
                            if (col) {
                                col.widthPercent = widthPercent;
                                this.resourceList?.forceUpdate();
                            }
                        });
                    }}
                >
                    {activeColumns.flatMap((column, index) => {
                        return [
                            <ResizablePanel
                                minSize={5}
                                defaultSize={column.widthPercent}
                                key={column.field + index}
                                className="flex items-center overflow-hidden font-medium text-ellipsis select-none"
                            >
                                <span
                                    className="flex cursor-pointer items-center gap-2 overflow-hidden px-2 text-ellipsis whitespace-nowrap"
                                    onClick={() =>
                                        this.setColumSorting(
                                            column.field,
                                            match(column.direction)
                                                .with(
                                                    SortDirection.Ascending,
                                                    () => SortDirection.Descending
                                                )
                                                .with(
                                                    SortDirection.Descending,
                                                    () => SortDirection.Neutral
                                                )
                                                .with(
                                                    SortDirection.Neutral,
                                                    () => SortDirection.Ascending
                                                )
                                                .exhaustive()
                                        )
                                    }
                                >
                                    {column.label}
                                    {match(column.direction)
                                        .with(SortDirection.Ascending, () => <IoChevronUp />)
                                        .with(SortDirection.Descending, () => (
                                            <IoChevronUp className="mt-[1px] rotate-180" />
                                        ))
                                        .with(SortDirection.Neutral, () => "")
                                        .exhaustive()}
                                </span>
                            </ResizablePanel>,
                            index !== activeColumns.length - 1 && (
                                <ResizableHandle
                                    className="group-hover:bg-border bg- hover:bg-accent active:bg-accent h-3/4"
                                    key={column.field + index + "Handle"}
                                />
                            )
                        ];
                    })}
                </ResizablePanelGroup>
                <span className="absolute top-0 right-0">
                    <OptionPicker
                        triggerComponent={<LucideColumns3 />}
                        header="Columns"
                        showCount={false}
                        onOptionChange={(id: string, enabled: boolean) => {
                            this.columns = this.columns.map((c) => {
                                if (c.field === id) {
                                    c.enabled = enabled;
                                }
                                return c;
                            });
                            this.resourceList?.forceUpdate();
                        }}
                        options={this.columns.map((column) => {
                            return {
                                id: column.field,
                                label: column.label,
                                enabled: column.enabled
                            };
                        })}
                    />
                </span>
            </div>
        );
    };

    rowRenderer = (rowProps: RowComponentProps<FilezResourceType>) => {
        if (rowProps.data === undefined) return;
        const item = rowProps.data?.items?.[rowProps.index]!;
        if (!item) return;
        const isSelected = rowProps.data.selectedItems[rowProps.index] === true;
        const style = rowProps.style;
        const isLastSelected = rowProps.data.lastSelectedItemIndex === rowProps.index;

        const onItemClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
            rowProps.data?.handlers.onItemClick?.(e, getCurrentItem(), rowProps.index);
        };

        const getCurrentItem = (): FilezResourceType => {
            return rowProps.data?.items?.[rowProps.index]!;
        };

        return (
            <div
                style={{
                    ...style
                }}
                className={cn(
                    `ColumnListRowRenderer flex w-full flex-row gap-[1px] overflow-hidden whitespace-nowrap select-none`,
                    isSelected ? "bg-accent" : "",
                    isLastSelected ? "bg-accent" : ""
                )}
            >
                {this.props.checkboxSelectionColumn && (
                    <div className="flex h-full w-8 items-center justify-center">
                        <Checkbox
                            onClick={(e) => {
                                e.ctrlKey = true;
                                onItemClick(e as any);
                            }}
                            checked={isSelected}
                        ></Checkbox>
                    </div>
                )}

                {this.columns
                    .filter((c) => c.enabled)
                    .map((column, index) => {
                        return (
                            <span
                                onClick={onItemClick}
                                key={column.field + index}
                                className="flex h-full items-center overflow-hidden text-ellipsis whitespace-nowrap"
                                style={{
                                    flex: `${column.widthPercent} 1 0px`
                                }}
                            >
                                <span className="p-2">{column.render(item, {}, "w-full")}</span>
                            </span>
                        );
                    })}
            </div>
        );
    };

    getRowCount = (itemCount: number, _gridColumnCount: number): number => {
        return itemCount;
    };
    getRowHeight = (_width: number, _height: number, _gridColumnCount: number): number => {
        return this.rowHeight;
    };
    getItemKey = (
        _items: (FilezResourceType | undefined)[],
        index: number,
        _gridColumnCount: number
    ): number => {
        return index;
    };
    isItemLoaded = (
        items: (FilezResourceType | undefined)[],
        index: number,
        _gridColumnCount: number
    ): boolean => {
        return items[index] !== undefined;
    };
    getStartIndexAndLimit = (
        startIndex: number,
        limit: number,
        _gridColumnCount: number
    ): { startIndex: number; limit: number } => {
        return { startIndex, limit };
    };
    getSelectedItemsAfterKeypress = (
        e: React.KeyboardEvent<HTMLDivElement>,
        items: (FilezResourceType | undefined)[],
        total_count: number,
        selectedItems: (boolean | undefined)[],
        lastSelectedItemIndex: number | undefined,
        arrowKeyShiftSelectItemIndex: number | undefined,
        _gridColumnCount: number
    ) => {
        const keyOptions = ["ArrowUp", "ArrowDown"];
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

                let newIndex =
                    e.key === "ArrowUp" ? lastSelectedItemIndex - 1 : lastSelectedItemIndex + 1;

                if (newIndex >= items.length) {
                    newIndex = 0;
                } else if (newIndex < 0) {
                    newIndex = total_count - 1;
                }

                return {
                    scrollToRowIndex: newIndex,
                    nextSelectedItemIndex: newIndex,
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
