import { SortOrder } from "@firstdorsal/filez-client/dist/js/apiTypes/SortOrder";
import { CSSProperties, PureComponent, createRef } from "react";
import InfiniteLoader from "react-window-infinite-loader";
import update from "immutability-helper";
import SortingBar from "./SortingBar";
import { FixedSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import ListTopBar from "./ListTopBar";
import { cloneDeep } from "lodash";
import { FilezContext } from "../../../FilezProvider";
import "react-contexify/dist/ReactContexify.css";
import { MenuItems, defaultMenuItems } from "./DefaultMenuItems";
import { GetItemListRequestBody } from "@firstdorsal/filez-client/dist/js/apiTypes/GetItemListRequestBody";
import { GetItemListResponseBody } from "@firstdorsal/filez-client/dist/js/apiTypes/GetItemListResponseBody";
import {
    RowRenderer,
    Column,
    ResourceListRowHandlers,
    ResourceListHandlers,
    BaseResource,
    ColumnDirection,
    RowRendererDirection
} from "./ResourceListTypes";

enum LoadItemMode {
    Reload,
    NewId,
    All
}

interface ResourceListProps<ResourceType> {
    /**
     The default field to sort the list by.
     */
    readonly defaultSortField: string;
    /**
     The type of the resource to be displayed.
     */
    readonly resourceType: string;
    /**
     The available row renderers
     */
    readonly rowRenderers: RowRenderer<ResourceType>[];
    /**
     A function that gets the resource in from the server/db and returns it. This has to be implemented in a specific way to support the infinite scrolling.
     */
    readonly get_items_function: (
        body: GetItemListRequestBody
    ) => Promise<GetItemListResponseBody<ResourceType>>;

    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly topBar?: JSX.Element;
    readonly id?: string;
    readonly columns?: Column<ResourceType>[];
    readonly disableContextMenu?: boolean;
    readonly initialListType?: string;
    readonly rowHandlers?: ResourceListRowHandlers<ResourceType>;
    readonly handlers?: ResourceListHandlers<ResourceType>;
    readonly resourceCreatable?: boolean;
    readonly dropTargetAcceptsTypes?: string[];
}

interface ResourceListState<ResourceType> {
    readonly items: (ResourceType | undefined)[];
    readonly total_count: number;
    readonly commitedSearch: string;
    readonly columns?: Column<ResourceType>[];
    readonly listType: string;
    readonly menuItems: MenuItems;
    readonly selectedItems: (boolean | undefined)[];
    readonly lastSelectedItemIndex?: number;
    readonly arrowKeyShiftSelectItemIndex?: number;
    readonly gridColumnCount: number;
    readonly scrollOffset: number;
    readonly width: number | null;
    readonly height: number | null;
}

export default class ResourceList<
    ResourceType extends BaseResource
> extends PureComponent<
    ResourceListProps<ResourceType>,
    ResourceListState<ResourceType>
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    infiniteLoaderRef = createRef<InfiniteLoader>();
    listOuterRef = createRef<HTMLDivElement>();
    moreItemsLoading = false;
    lastStartIndex = 0;
    contextMenuRender: JSX.Element;

    constructor(props: ResourceListProps<ResourceType>) {
        super(props);
        this.contextMenuRender = <></>;
        this.state = {
            items: [],
            total_count: 0,
            commitedSearch: "",
            columns: cloneDeep(props.columns),
            listType:
                this.props.initialListType ?? this.props.rowRenderers[0].name,
            menuItems: cloneDeep(defaultMenuItems),
            selectedItems: [],
            gridColumnCount: 10,
            scrollOffset: 0,
            width: null,
            height: null
        };
    }

    componentDidMount = async () => {
        await this.loadItems();
    };

    componentDidUpdate = async (
        prevProps: Readonly<ResourceListProps<ResourceType>>,
        _prevState: Readonly<ResourceListState<ResourceType>>
    ) => {
        if (prevProps.id !== this.props.id) {
            await this.loadItems(LoadItemMode.NewId);
            //this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
        }
    };

    getCurrentVisibleItemsRange = (
        scrollOffset: number
    ): { startIndex: number; endIndex: number } => {
        const currentRowRenderer = this.getCurrentRowRenderer();

        const { width, height } = this.state;
        if (!currentRowRenderer || width === null || height === null)
            return { startIndex: 0, endIndex: 30 };

        const rowHeight = currentRowRenderer.getRowHeight(
            width,
            height,
            this.state.gridColumnCount
        );
        const startIndex = Math.floor(scrollOffset / rowHeight);
        const endIndex = Math.ceil((scrollOffset + height) / rowHeight);

        return { startIndex, endIndex };
    };

    loadItems = async (mode?: LoadItemMode) => {
        if (mode === LoadItemMode.NewId) {
            //@ts-ignore
            this.infiniteLoaderRef.current._listRef.scrollToItem(0);
        }
        const currentRowRenderer = this.getCurrentRowRenderer();
        if (!currentRowRenderer) return;

        const { sort_field, sort_order } = this.get_current_column_sorting();

        // this gets the visible rows
        const cvir = this.getCurrentVisibleItemsRange(
            mode === LoadItemMode.NewId ? 0 : this.state.scrollOffset
        );

        let { startIndex, limit } = currentRowRenderer.getStartIndexAndLimit(
            cvir.startIndex,
            cvir.endIndex - cvir.startIndex + 1,
            this.state.gridColumnCount
        );

        if (mode === LoadItemMode.All) {
            startIndex = 0;
            limit = this.state.total_count;
        }

        this.moreItemsLoading = true;
        const { items: newItems, total_count } =
            await this.props.get_items_function({
                id: this.props.id,
                from_index: startIndex,
                limit,
                sort_field,
                sort_order,
                filter: this.state.commitedSearch
            });
        this.moreItemsLoading = false;

        this.setState(({ items, selectedItems }) => {
            if (mode === LoadItemMode.NewId || mode === LoadItemMode.Reload) {
                items = [];
            }
            for (let i = 0; i < newItems.length; i++) {
                items[startIndex + i] = newItems[i];
            }

            if (mode === LoadItemMode.NewId) {
                selectedItems = [];
            }

            return { items, total_count, selectedItems };
        });
    };

    get_current_column_sorting = (): {
        sort_field: string;
        sort_order: SortOrder;
    } => {
        const columns = this.state.columns;
        if (!columns) {
            return {
                sort_field: this.props.defaultSortField,
                sort_order: "Ascending"
            };
        }
        for (const column of columns) {
            if (column.direction !== ColumnDirection.NEUTRAL) {
                return {
                    sort_field: column.field,
                    sort_order:
                        column.direction === ColumnDirection.ASCENDING
                            ? "Ascending"
                            : "Descending"
                };
            }
        }
        return {
            sort_field: this.props.defaultSortField,
            sort_order: "Ascending"
        };
    };

    loadMoreItems = async (startIndex: number, endIndex: number) => {
        let limit = endIndex - startIndex + 1;
        //if (this.moreItemsLoading) return;
        const { sort_field, sort_order } = this.get_current_column_sorting();

        const currentRowRenderer = this.getCurrentRowRenderer();
        if (!currentRowRenderer) return;

        const sial = currentRowRenderer.getStartIndexAndLimit(
            startIndex,
            limit,
            this.state.gridColumnCount
        );
        startIndex = sial.startIndex;
        limit = sial.limit;

        // TODO this is triggering a lot of unnecessary requests when dragging down the scrollbar
        //if (startIndex === this.lastStartIndex) return;

        //this.moreItemsLoading = true;
        //this.lastStartIndex = startIndex;
        const { items: newItems } = await this.props.get_items_function({
            id: this.props.id,
            from_index: startIndex,
            limit,
            sort_field,
            sort_order,
            filter: this.state.commitedSearch
        });
        //this.moreItemsLoading = false;

        const updatedItems = update(this.state.items, {
            $apply: (currentItems: (ResourceType | undefined)[]) => {
                for (let i = 0; i < newItems.length; i++) {
                    currentItems[startIndex + i] = newItems[i];
                }
                return currentItems;
            }
        });

        this.setState({ items: updatedItems });

        return { newItems, updatedItems };
    };

    updateSortingColumnWidths = (columns: number[]) => {
        this.setState((state) => {
            if (state.columns === undefined) return state;

            return update(state, {
                columns: {
                    $set: state.columns.map((column, index) => {
                        if (column.visible === false) return column;
                        return {
                            ...column,
                            widthPercent: columns[index]
                        };
                    })
                }
            });
        });
    };

    createColumn = (field: string) => {
        this.setState((state) => {
            if (state.columns === undefined) return state;

            const widthPercent = 100 / (state.columns.length + 1);

            const newColumn: Column<ResourceType> = {
                field,
                direction: ColumnDirection.NEUTRAL,
                widthPercent,
                minWidthPixels: 50,
                visible: true,
                label: field
            };

            return update(state, {
                columns: {
                    $set: [
                        ...state.columns.map((c) => {
                            // update the widthPercent that all columns have in total 100%
                            c.widthPercent = widthPercent;
                            return c;
                        }),
                        newColumn
                    ]
                }
            });
        });
    };

    updateColumnDirections = async (columnId: string) => {
        this.setState(
            (state) => {
                if (state.columns === undefined) return state;

                return update(state, {
                    columns: {
                        $set: state.columns.map((column) => {
                            if (column.field === columnId) {
                                return {
                                    ...column,
                                    direction:
                                        column.direction ===
                                        ColumnDirection.ASCENDING
                                            ? ColumnDirection.DESCENDING
                                            : ColumnDirection.ASCENDING
                                };
                            } else {
                                return {
                                    ...column,
                                    direction: ColumnDirection.NEUTRAL
                                };
                            }
                        })
                    }
                });
            },
            () => {
                this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
                this.loadItems(LoadItemMode.Reload);
            }
        );
    };

    updateListViewMode = (listType: string) => {
        this.setState({ listType });
    };

    commitSearch = (search: string) => {
        this.setState({ commitedSearch: search }, () => {
            this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
            this.loadItems();
        });
    };

    refreshList = async () => {
        this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
        await this.loadItems(LoadItemMode.Reload);
    };

    onContextMenuItemClick = (
        item: ResourceType,
        menuItemId: string,
        selectedItems: ResourceType[]
    ) => {
        this.props.rowHandlers?.onContextMenuItemClick?.(
            item,
            menuItemId,
            selectedItems,
            // @ts-ignore
            this.state.items[this.state.lastSelectedItemIndex ?? 0]
        );
    };

    onDrop = (targetItemId: string, targetItemType: string) => {
        const selectedItems = this.getSelectedItems();
        this.props.rowHandlers?.onDrop?.(
            targetItemId,
            targetItemType,
            selectedItems
        );
    };

    onItemClick = async (
        e:
            | React.MouseEvent<HTMLDivElement, MouseEvent>
            | React.TouchEvent<HTMLDivElement>,
        item: ResourceType,
        index: number,
        rightClick?: boolean,
        dragged?: boolean
    ) => {
        // @ts-ignore
        if (e.target?.classList?.contains("clickable")) return; // eslint-disable-line

        this.props.rowHandlers?.onClick?.(e, item, index, rightClick, dragged);

        const afterStateUpdate = () =>
            this.props.handlers?.onSelect?.(this.getSelectedItems(), item);

        if (e.ctrlKey) {
            const selectedItems = cloneDeep(this.state.selectedItems);
            const currentSelectionState =
                this.state.selectedItems[index] === undefined ||
                this.state.selectedItems[index] === false
                    ? false
                    : true;
            selectedItems[index] = !currentSelectionState;

            const lastSelectedItemIndex = (() => {
                if (
                    index === this.state.lastSelectedItemIndex ||
                    currentSelectionState
                ) {
                    return undefined;
                }

                return index;
            })();

            this.setState(
                update(this.state, {
                    selectedItems: {
                        $set: selectedItems
                    },
                    lastSelectedItemIndex: {
                        $set: lastSelectedItemIndex
                    }
                }),
                afterStateUpdate
            );
        } else if (e.shiftKey) {
            const toBeSet = await (async () => {
                const state = this.state;
                const selectedItems = cloneDeep(state.selectedItems);
                const noneSelected = selectedItems.every((selected) => {
                    return selected === false;
                });

                if (noneSelected) {
                    selectedItems[index] = true;
                    return selectedItems;
                }

                const startIndex = this.state.lastSelectedItemIndex ?? 0;

                const endIndex = index;

                const minIndex = Math.min(startIndex, endIndex);
                const maxIndex = Math.max(startIndex, endIndex);

                const allToBeSelectedLoaded = this.isItemRangeLoaded(
                    minIndex,
                    maxIndex
                );

                if (!allToBeSelectedLoaded) {
                    await this.loadMoreItems(minIndex, maxIndex);
                }

                for (let i = minIndex; i <= maxIndex; i++) {
                    selectedItems[i] = true;
                }

                return selectedItems;
            })();

            this.setState((state) => {
                return update(state, {
                    selectedItems: {
                        $set: toBeSet
                    },
                    lastSelectedItemIndex: {
                        $set: index
                    }
                });
            }, afterStateUpdate);
        } else if (rightClick === true || dragged === true) {
            const selectedItems = this.getSelectedItems();
            const currentItemInSelectedItems =
                selectedItems.find(
                    (selectedItem) => selectedItem._id === item._id
                ) !== undefined;

            if (!currentItemInSelectedItems) {
                const newSelectedItems = [];
                newSelectedItems[index] = true;
                this.setState({
                    selectedItems: newSelectedItems,
                    lastSelectedItemIndex: index
                });
            }
        } else {
            const selectedItems = [];
            selectedItems[index] = true;
            this.setState(
                {
                    selectedItems,
                    lastSelectedItemIndex: index
                },
                afterStateUpdate
            );
        }
    };

    isItemRangeLoaded = (startIndex: number, endIndex: number) => {
        const { items } = this.state;
        for (let i = startIndex; i < endIndex; i++) {
            if (items[i] === undefined) return false;
        }
        return true;
    };

    getSelectedItems = (): ResourceType[] => {
        return getSelectedItems(this.state.items, this.state.selectedItems);
    };

    updateColumnVisibility = (columnId: string, visible: boolean) => {
        this.setState((state) => {
            if (!state.columns) return state;
            return update(state, {
                columns: {
                    $set: state.columns.map((column) => {
                        if (column.field === columnId) {
                            return {
                                ...column,
                                visible
                            };
                        }
                        return column;
                    })
                }
            });
        });
    };

    updateGridColumnCount = (columnCount: number) => {
        this.setState({ gridColumnCount: columnCount });
    };

    isItemLoaded = (index: number) => {
        const currentRowRenderer = this.getCurrentRowRenderer();

        if (currentRowRenderer?.isItemLoaded) {
            return currentRowRenderer?.isItemLoaded(
                this.state.items,
                index,
                this.state.gridColumnCount
            );
        }
        return this.state.items[index] !== undefined;
    };

    onScroll = ({
        scrollOffset
    }: {
        scrollDirection: "forward" | "backward";
        scrollOffset: number;
        scrollUpdateWasRequested: boolean;
    }) => {
        this.setState({ scrollOffset });
    };

    getItemKey = (index: number) => {
        const currentRowRenderer = this.getCurrentRowRenderer();

        if (currentRowRenderer?.getItemKey) {
            return currentRowRenderer?.getItemKey(
                this.state.items,
                index,
                this.state.gridColumnCount
            );
        }
        return this.state.items[index]?._id ?? index;
    };

    updateDimesions = ({
        height,
        width
    }: {
        height: number;
        scaledHeight: number;
        scaledWidth: number;
        width: number;
    }) => {
        this.setState({ width, height });
    };

    onAddResourceClick = () => {
        this.props.handlers?.onCreateClick?.();
    };

    getCurrentRowRenderer = () => {
        return this.props.rowRenderers.find(
            (rowRenderer) => rowRenderer.name === this.state.listType
        );
    };

    handleCommonHotkeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey) {
            if (e.key === "a") {
                e.preventDefault();
                this.setState(
                    {
                        selectedItems: new Array(this.state.total_count).fill(
                            true
                        )
                    },
                    async () => {
                        await this.loadItems(LoadItemMode.All);
                        this.props.handlers?.onSelect?.(
                            this.getSelectedItems(),
                            this.state.items[
                                this.state.lastSelectedItemIndex ?? 0
                            ]
                        );
                    }
                );
            }
        }
    };

    onListKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const currentRowRenderer = this.getCurrentRowRenderer();

        // TODO use a starting point when shift selecting for mouse selection like right now when selecting with the arrow keys and shift

        this.handleCommonHotkeys(e);

        const selectedItemsAfterKeypress =
            currentRowRenderer?.getSelectedItemsAfterKeypress(
                e,
                this.state.items,
                this.state.total_count,
                this.state.selectedItems,
                this.state.lastSelectedItemIndex,
                this.state.arrowKeyShiftSelectItemIndex,
                this.state.gridColumnCount
            );

        if (selectedItemsAfterKeypress === undefined) return;

        const {
            scrollToRowIndex,
            nextSelectedItemIndex,
            arrowKeyShiftSelectItemIndex
        } = selectedItemsAfterKeypress;

        const selectedItems = (() => {
            const s = [];
            const startIndex = Math.min(
                nextSelectedItemIndex,
                arrowKeyShiftSelectItemIndex ?? nextSelectedItemIndex
            );
            const endIndex = Math.max(
                nextSelectedItemIndex,
                arrowKeyShiftSelectItemIndex ?? nextSelectedItemIndex
            );

            for (let i = startIndex; i <= endIndex; i++) {
                s[i] = true;
            }
            return s;
        })();

        this.setState(
            {
                selectedItems,
                lastSelectedItemIndex: nextSelectedItemIndex,
                arrowKeyShiftSelectItemIndex
            },
            () => {
                this.props.handlers?.onSelect?.(
                    this.getSelectedItems(),
                    this.state.items[this.state.lastSelectedItemIndex ?? 0]
                );
            }
        );

        // scroll to the new selected item
        // @ts-ignore
        this.infiniteLoaderRef.current._listRef.scrollToItem(scrollToRowIndex);
    };

    render = () => {
        if (!this.context?.filezClient) return;
        const fullListLength = this.state.total_count;

        const barHeights = (() => {
            let height = 0;
            if (this.props.displayTopBar !== false) {
                height += 40;
            }
            if (this.props.displaySortingBar !== false) {
                height += 20;
            }
            return height;
        })();

        const currentRowRenderer = this.getCurrentRowRenderer();

        if (!currentRowRenderer) return <></>;

        const itemCount = currentRowRenderer.getRowCount(
            fullListLength,
            this.state.gridColumnCount
        );

        // TODO this should be adjusted depending on the row renderer
        const minimumBatchSize = Math.max(
            Math.min(20, this.state.total_count / 1000),
            1000
        );
        const loadMoreItemsThreshold = minimumBatchSize / 2;

        return (
            <div className="Filez ResourceList" style={{ ...this.props.style }}>
                {this.props.displayTopBar !== false && (
                    <ListTopBar
                        items={this.state.items}
                        total_count={this.state.total_count}
                        selectedItems={this.state.selectedItems}
                        rowRenderers={this.props.rowRenderers}
                        refreshList={this.refreshList}
                        resourceType={this.props.resourceType}
                        updateListType={this.updateListViewMode}
                        currentListType={this.state.listType}
                        commitSearch={this.commitSearch}
                        updateGridColumnCount={this.updateGridColumnCount}
                        gridColumnCount={this.state.gridColumnCount}
                        resourceCreatable={this.props.resourceCreatable}
                        onAddResourceClick={this.onAddResourceClick}
                    />
                )}
                {this.props.displaySortingBar !== false &&
                    this.state.columns && (
                        <SortingBar
                            resourceListId={this.props.id ?? ""}
                            columns={this.state.columns}
                            updateColumnDirections={this.updateColumnDirections}
                            updateSortingColumnWidths={
                                this.updateSortingColumnWidths
                            }
                            updateColumnVisibility={this.updateColumnVisibility}
                            createColumn={this.createColumn}
                        />
                    )}
                <div
                    style={{
                        width: "100%",
                        height: `calc(100% - ${barHeights}px)`
                    }}
                    className="OuterResourceList"
                    tabIndex={0}
                    onKeyDown={this.onListKeyDown}
                >
                    <AutoSizer onResize={this.updateDimesions}>
                        {({ height, width }) => {
                            return (
                                <InfiniteLoader
                                    isItemLoaded={this.isItemLoaded}
                                    itemCount={itemCount}
                                    //@ts-ignore
                                    loadMoreItems={this.loadMoreItems}
                                    ref={this.infiniteLoaderRef}
                                    minimumBatchSize={minimumBatchSize}
                                    threshold={loadMoreItemsThreshold}
                                >
                                    {({ onItemsRendered, ref }) => {
                                        const rowHeight =
                                            currentRowRenderer.getRowHeight(
                                                width,
                                                height,
                                                this.state.gridColumnCount
                                            );

                                        return (
                                            <FixedSizeList
                                                outerRef={this.listOuterRef}
                                                itemKey={this.getItemKey}
                                                itemSize={rowHeight}
                                                height={height}
                                                onScroll={this.onScroll}
                                                overscanCount={5}
                                                itemCount={itemCount}
                                                width={width}
                                                onItemsRendered={
                                                    onItemsRendered
                                                }
                                                ref={ref}
                                                // without this the context menu cannot be positioned fixed
                                                // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                                style={{
                                                    willChange: "none",
                                                    overflowY: "scroll"
                                                }}
                                                layout={
                                                    currentRowRenderer.direction ===
                                                    RowRendererDirection.Horizontal
                                                        ? "horizontal"
                                                        : "vertical"
                                                }
                                                itemData={{
                                                    items: this.state.items,
                                                    total_count:
                                                        this.state.total_count,
                                                    dropTargetAcceptsTypes:
                                                        this.props
                                                            .dropTargetAcceptsTypes,
                                                    handlers: {
                                                        //@ts-ignore TODO fix this
                                                        onItemClick:
                                                            this.onItemClick,
                                                        onDrop: this.onDrop,
                                                        onContextMenuItemClick:
                                                            this
                                                                .onContextMenuItemClick
                                                    },
                                                    functions: {
                                                        getSelectedItems:
                                                            this
                                                                .getSelectedItems
                                                    },
                                                    selectedItems:
                                                        this.state
                                                            .selectedItems,
                                                    lastSelectedItemIndex:
                                                        this.state
                                                            .lastSelectedItemIndex,

                                                    //@ts-ignore TODO fix this
                                                    columns: this.state.columns,
                                                    disableContextMenu:
                                                        this.props
                                                            .disableContextMenu,
                                                    //TODO fix this
                                                    menuItems:
                                                        this.state.menuItems,
                                                    resourceType:
                                                        this.props.resourceType,
                                                    gridColumnCount:
                                                        this.state
                                                            .gridColumnCount,
                                                    rowHeight,
                                                    rowHandlers:
                                                        this.props.rowHandlers
                                                }}
                                            >
                                                {/*@ts-ignore*/}
                                                {currentRowRenderer.component}
                                            </FixedSizeList>
                                        );
                                    }}
                                </InfiniteLoader>
                            );
                        }}
                    </AutoSizer>
                </div>
            </div>
        );
    };
}

export const getSelectedItems = <ResourceType,>(
    items: (ResourceType | undefined)[],
    selectedItems: (boolean | undefined)[]
): ResourceType[] => {
    return selectedItems.flatMap((selected, index) => {
        if (selected === true) {
            return items[index] ?? [];
        }
        return [];
    });
};

export const getSelectedCount = (
    selectedItems: (boolean | undefined)[],
    total_count: number
) => {
    let count = 0;
    for (let i = 0; i < total_count; i++) {
        if (selectedItems[i] === true) {
            count++;
        }
    }

    return count;
};
