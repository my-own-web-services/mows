import OptionPicker from "@/components/atoms/OptionPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { SortDirection } from "filez-client-typescript";
import { LucideColumns3 } from "lucide-react";
import { Component, CSSProperties, JSX } from "react";
import { FaThList } from "react-icons/fa";
import { IoChevronUp } from "react-icons/io5";
import { match } from "ts-pattern";
import ResourceList from "../ResourceList";
import {
    BaseResource,
    ListRowHandler,
    LoadItemMode,
    RowComponentProps,
    RowRendererDirection,
    SelectedItemsAfterKeypress
} from "../ResourceListTypes";
import { getSelectedCount } from "../utils";

export interface ColumnListRowHandlerProps<FilezResourceType> {
    columns: Column<FilezResourceType>[];
    hideSelectionCheckboxColumn?: boolean;
    hideColumnPicker?: boolean;
    hideColumnHeader?: boolean;
    disableColumnSorting?: boolean;
    disableColumnResizing?: boolean;
    rowHeightPixels?: number;
    selectAllTitle?: string;
}

export interface ColumnListRowHandlerState<FilezResourceType> {
    columns: Column<FilezResourceType>[];
}

export default class ColumnListRowHandler<FilezResourceType extends BaseResource>
    extends Component<
        ColumnListRowHandlerProps<FilezResourceType>,
        ColumnListRowHandlerState<FilezResourceType>
    >
    implements ListRowHandler<FilezResourceType>
{
    id = `ColumnListRowHandler`;
    name = `Columns`;
    icon = (<FaThList height={`100%`} />);
    direction = RowRendererDirection.Vertical;
    //columns: Column<FilezResourceType>[];
    resourceList: InstanceType<typeof ResourceList> | undefined;
    rowHeightPixels = 24;
    props: ColumnListRowHandlerProps<FilezResourceType>;

    constructor(props: ColumnListRowHandlerProps<FilezResourceType>) {
        super(props);
        this.props = props;

        if (props.rowHeightPixels !== undefined) {
            this.rowHeightPixels = props.rowHeightPixels;
        }

        this.checkColumns(props.columns);
        this.state = { columns: props.columns };
    }

    checkColumns = (columns: Column<FilezResourceType>[]) => {
        // check if the columns have unique field names else throw an error
        const fieldNames = columns.map((c) => c.field);
        const uniqueFieldNames = Array.from(new Set(fieldNames));
        if (fieldNames.length !== uniqueFieldNames.length) {
            throw new Error(`Column field names must be unique`);
        }

        // check if only one column has the sort order set to anything but neutral
        const sortedColumns = columns.filter((c) => c.direction !== SortDirection.Neutral);
        if (sortedColumns.length > 1) {
            const sortedColumnNames = sortedColumns.map((c) => c.field).join(`, `);
            throw new Error(
                `Only one column can have the sort order set to anything but neutral. The following columns are wrong: ${sortedColumnNames}`
            );
        }
    };

    getMinimumBatchSize = (_totalCount: number): number => {
        return 50;
    };

    getLoadMoreItemsThreshold = (_totalCount: number): number => {
        return 20;
    };

    setColumSorting = (field: string, newDirection: SortDirection) => {
        // Only update state if component is mounted
        if (this.state) {
            this.setState({
                columns: this.state.columns.map((c) => {
                    if (c.field === field) {
                        c.direction = newDirection;
                    } else {
                        c.direction = SortDirection.Neutral;
                    }
                    return c;
                })
            });
        }

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
        const columns = this.state.columns;
        const activeColumns = columns.filter((c) => c.enabled);

        if (this.props.hideColumnHeader === true) return <></>;

        return (
            <div className={`relative flex h-8 border-b-1`} style={{ width: `calc(100% - 17px)` }}>
                {this.props.hideSelectionCheckboxColumn !== true && (
                    <div className={`flex h-full w-8 items-center justify-center`}>
                        <Checkbox
                            checked={
                                getSelectedCount(this.resourceList?.state.selectedItems) ===
                                    this.resourceList?.state.totalItemCount &&
                                (this.resourceList?.state.totalItemCount ?? 0) > 0
                            }
                            onCheckedChange={(checkedState) => {
                                if (checkedState.valueOf()) {
                                    this.resourceList?.selectAll();
                                } else {
                                    this.resourceList?.deselectAll();
                                }
                            }}
                            title={this.props.selectAllTitle}
                        ></Checkbox>
                    </div>
                )}
                <ResizablePanelGroup
                    className={`group items-center`}
                    direction={`horizontal`}
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
                        const disableColumnSorting =
                            this.props.disableColumnSorting === true ||
                            column.disableSorting === true;

                        const disableColumnResizing =
                            this.props.disableColumnResizing === true ||
                            column.disableResizing === true;

                        const isLastColumn = index === activeColumns.length - 1;
                        return [
                            <ResizablePanel
                                minSize={5}
                                defaultSize={column.widthPercent}
                                key={column.field + index}
                                className={`flex items-center overflow-hidden font-medium text-ellipsis select-none`}
                            >
                                <span
                                    className={cn(
                                        `flex items-center gap-2 overflow-hidden px-2 text-ellipsis whitespace-nowrap`,
                                        disableColumnSorting ? `cursor-default` : `cursor-pointer`
                                    )}
                                    onClick={() => {
                                        if (disableColumnSorting) return;
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
                                        );
                                    }}
                                >
                                    {column.disableLabel ? null : column.label}
                                    {disableColumnSorting
                                        ? null
                                        : match(column.direction)
                                              .with(SortDirection.Ascending, () => <IoChevronUp />)
                                              .with(SortDirection.Descending, () => (
                                                  <IoChevronUp className={`mt-[1px] rotate-180`} />
                                              ))
                                              .with(SortDirection.Neutral, () => ``)
                                              .exhaustive()}
                                </span>
                            </ResizablePanel>,
                            !isLastColumn && !disableColumnResizing && (
                                <ResizableHandle
                                    className={cn(
                                        `group-hover:bg-border bg- hover:bg-accent active:bg-accent h-3/4`
                                    )}
                                    key={column.field + index + `Handle`}
                                />
                            )
                        ];
                    })}
                </ResizablePanelGroup>
                {this.props.hideColumnPicker !== true && (
                    <span className={`absolute top-0 -right-4`}>
                        <OptionPicker
                            triggerComponent={<LucideColumns3 />}
                            header={`Columns`}
                            showCount={false}
                            onOptionChange={(id: string, enabled: boolean) => {
                                this.setState({
                                    columns: columns.map((c) => {
                                        if (c.field === id) {
                                            c.enabled = enabled;
                                        }
                                        return c;
                                    })
                                });
                                this.resourceList?.forceUpdate();
                            }}
                            options={columns.map((column) => {
                                return {
                                    id: column.field,
                                    label: column.label,
                                    enabled: column.enabled
                                };
                            })}
                        />
                    </span>
                )}
            </div>
        );
    };

    rowRenderer = (rowProps: RowComponentProps<FilezResourceType>) => {
        if (rowProps.data === undefined) return;
        const item = rowProps.data?.items?.[rowProps.index]!;
        const listId = rowProps.data?.listInstanceId;
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

        const columns = this.state.columns;

        return (
            <div
                style={{
                    ...style
                }}
                className={cn(
                    `ColumnListRowRenderer hover:bg-secondary/100 flex w-full flex-row gap-[1px] overflow-hidden whitespace-nowrap select-none`,
                    isSelected && `bg-secondary/60`,
                    isLastSelected && `bg-secondary/100`
                )}
            >
                {this.props.hideSelectionCheckboxColumn !== true && (
                    <div
                        onClick={(e) => {
                            e.ctrlKey = true;
                            onItemClick(e as any);
                        }}
                        className={`flex h-full w-8 cursor-pointer items-center justify-center`}
                    >
                        <Checkbox checked={isSelected}></Checkbox>
                    </div>
                )}

                {columns
                    .filter((c) => c.enabled)
                    .map((column, index) => {
                        return (
                            <span
                                onClick={onItemClick}
                                onContextMenu={onItemClick}
                                key={column.field + index}
                                className={`flex h-full items-center overflow-hidden text-ellipsis whitespace-nowrap`}
                                style={{
                                    flex: `${column.widthPercent} 1 0px`
                                }}
                            >
                                <span className={`p-2`}>
                                    {column.render(item, {}, `w-full`, listId)}
                                </span>
                            </span>
                        );
                    })}
            </div>
        );
    };

    getRowCount = (itemCount: number): number => {
        return itemCount;
    };
    getRowHeight = (_width: number, _height: number): number => {
        return this.rowHeightPixels;
    };
    getItemKey = (_items: (FilezResourceType | undefined)[], index: number): number => {
        return index;
    };
    isItemLoaded = (items: (FilezResourceType | undefined)[], index: number): boolean => {
        return items[index] !== undefined;
    };
    getStartIndexAndLimit = (
        startIndex: number,
        limit: number
    ): { startIndex: number; limit: number } => {
        return { startIndex, limit };
    };
    getSelectedItemsAfterKeypress = (
        e: React.KeyboardEvent<HTMLDivElement>,
        items: (FilezResourceType | undefined)[],
        total_count: number,
        selectedItems: (boolean | undefined)[],
        lastSelectedItemIndex: number | undefined,
        arrowKeyShiftSelectItemIndex: number | undefined
    ) => {
        const keyOptions = [`ArrowUp`, `ArrowDown`];
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
                    e.key === `ArrowUp` ? lastSelectedItemIndex - 1 : lastSelectedItemIndex + 1;

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
    label: string;
    direction: SortDirection;
    widthPercent: number;
    minWidthPixels: number;
    enabled: boolean;
    disableSorting?: boolean;
    disableResizing?: boolean;
    disableLabel?: boolean;
    render: (
        item: FilezResourceType,
        style: CSSProperties,
        className: string,
        listId: string
    ) => JSX.Element;
}
