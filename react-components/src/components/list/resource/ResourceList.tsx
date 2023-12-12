import { SortOrder } from "@firstdorsal/filez-client/dist/js/apiTypes/SortOrder";
import { CSSProperties, ComponentType, PureComponent, createRef } from "react";
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
import { onContextMenuItemClick } from "./RowContextMenu";

enum LoadItemMode {
    Reload,
    NewId
}

export interface RowRenderer<ResourceType> {
    readonly name: string;
    readonly icon: JSX.Element;
    readonly component: ComponentType<ListRowProps<ResourceType>>;
    readonly getRowHeight: (width: number, height: number, gridColumnCount: number) => number;
    readonly getRowCount: (itemCount: number, gridColumnCount: number) => number;
    readonly direction: RowRendererDirection;
    readonly isItemLoaded: (
        items: (ResourceType | undefined)[],
        index: number,
        gridColumnCount: number
    ) => boolean;
    readonly getItemKey: (
        items: (ResourceType | undefined)[],
        index: number,
        gridColumnCount: number
    ) => number;
    readonly getStartIndexAndLimit: (
        startIndex: number,
        limit: number,
        gridColumnCount: number
    ) => { startIndex: number; limit: number };
}

export interface ResourceListRowHandlers<ResourceType> {
    readonly onClick?: (
        e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
        item: ResourceType,
        rightClick?: boolean,
        dragged?: boolean
    ) => void;
    readonly onDrop?: (
        targetItemId: string,
        targetItemType: string,
        selectedItems: ResourceType[]
    ) => void;
    readonly onSelect?: (selectedItems: ResourceType[]) => void;
    readonly onContextMenuItemClick?: (
        item: ResourceType,
        menuItemId?: string,
        selectedItems?: ResourceType[]
    ) => void;
}

export interface ResourceListHandlers<ResourceType> {
    readonly onSearch?: (search: string) => void;
    readonly onRefresh?: () => void;
    readonly onListTypeChange?: (listType: string) => void;
    readonly onCreateClick: () => void;
}
export enum RowRendererDirection {
    Horizontal,
    Vertical
}

export interface ListRowProps<ResourceType> {
    readonly data: ListData<ResourceType>;
    readonly style: React.CSSProperties;
    readonly index: number;
}

export interface ListData<ResourceType> {
    readonly items: (ResourceType | undefined)[];
    readonly total_count: number;
    readonly handlers: {
        readonly onItemClick: InstanceType<typeof ResourceList>["onItemClick"];
        readonly onDrop: InstanceType<typeof ResourceList>["onDrop"];
        readonly onContextMenuItemClick?: onContextMenuItemClick<ResourceType>;
    };
    readonly functions: {
        readonly getSelectedItems: InstanceType<typeof ResourceList>["getSelectedItems"];
    };
    readonly selectedItems: SelectedItems;
    readonly columns?: Column<ResourceType>[];
    readonly disableContextMenu?: boolean;
    readonly menuItems: MenuItems;
    readonly resourceType: string;
    readonly gridColumnCount: number;
    readonly rowHeight: number;
    readonly rowHandlers?: ResourceListRowHandlers<ResourceType>;
}

export interface Column<ResourceType> {
    field: string;
    alternateField?: string;
    label: string;
    direction: ColumnDirection;
    widthPercent: number;
    minWidthPixels: number;
    visible: boolean;
    render?: (item: ResourceType) => JSX.Element;
}

export enum ColumnDirection {
    ASCENDING = 0,
    DESCENDING = 1,
    NEUTRAL = 2
}

export interface BaseResource {
    _id: string;
    [key: string]: any;
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
}

interface ResourceListState<ResourceType> {
    readonly items: (ResourceType | undefined)[];
    readonly total_count: number;
    readonly commitedSearch: string;
    readonly columns?: Column<ResourceType>[];
    readonly listType: string;
    readonly menuItems: MenuItems;
    readonly selectedItems: SelectedItems;
    readonly gridColumnCount: number;
    readonly scrollOffset: number;
    readonly width: number | null;
    readonly height: number | null;
}

export interface SelectedItems {
    [key: string]: boolean;
}

export default class ResourceList<ResourceType extends BaseResource> extends PureComponent<
    ResourceListProps<ResourceType>,
    ResourceListState<ResourceType>
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    infiniteLoaderRef = createRef<InfiniteLoader>();
    moreItemsLoading = false;
    contextMenuRender: JSX.Element;

    constructor(props: ResourceListProps<ResourceType>) {
        super(props);
        this.contextMenuRender = <></>;
        this.state = {
            items: [],
            total_count: 0,
            commitedSearch: "",
            columns: cloneDeep(props.columns),
            listType: this.props.initialListType ?? this.props.rowRenderers[0].name,
            menuItems: cloneDeep(defaultMenuItems),
            selectedItems: {},
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
        const currentRowRenderer = this.props.rowRenderers.find(
            rowRenderer => rowRenderer.name === this.state.listType
        );

        const { width, height } = this.state;
        if (!currentRowRenderer || !width || !height) return { startIndex: 0, endIndex: 30 };

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
        const currentRowRenderer = this.props.rowRenderers.find(
            rowRenderer => rowRenderer.name === this.state.listType
        );
        if (!currentRowRenderer) return;

        const { sort_field, sort_order } = this.get_current_column_sorting();

        // this gets the visible rows
        const cvir = this.getCurrentVisibleItemsRange(
            mode === LoadItemMode.NewId ? 0 : this.state.scrollOffset
        );

        const { startIndex, limit } = currentRowRenderer.getStartIndexAndLimit(
            cvir.startIndex,
            cvir.endIndex - cvir.startIndex + 1,
            this.state.gridColumnCount
        );

        this.moreItemsLoading = true;
        const { items: newItems, total_count } = await this.props.get_items_function({
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
                selectedItems = {};
            }

            return { items, total_count, selectedItems };
        });
    };

    get_current_column_sorting = (): { sort_field: string; sort_order: SortOrder } => {
        const columns = this.state.columns;
        if (!columns) {
            return { sort_field: this.props.defaultSortField, sort_order: "Ascending" };
        }
        for (const column of columns) {
            if (column.direction !== ColumnDirection.NEUTRAL) {
                return {
                    sort_field: column.field,
                    sort_order:
                        column.direction === ColumnDirection.ASCENDING ? "Ascending" : "Descending"
                };
            }
        }
        return { sort_field: this.props.defaultSortField, sort_order: "Ascending" };
    };

    loadMoreItems = async (startIndex: number, limit: number) => {
        if (this.moreItemsLoading) return;
        const { sort_field, sort_order } = this.get_current_column_sorting();

        const currentRowRenderer = this.props.rowRenderers.find(
            rowRenderer => rowRenderer.name === this.state.listType
        );
        if (!currentRowRenderer) return;

        const sial = currentRowRenderer.getStartIndexAndLimit(
            startIndex,
            limit,
            this.state.gridColumnCount
        );
        startIndex = sial.startIndex;
        limit = sial.limit;

        const { items: newItems } = await this.props.get_items_function({
            id: this.props.id,
            from_index: startIndex,
            limit,
            sort_field,
            sort_order,
            filter: this.state.commitedSearch
        });

        this.setState(({ items }) => {
            for (let i = 0; i < newItems.length; i++) {
                items[startIndex + i] = newItems[i];
            }
            return { items };
        });
        return newItems;
    };

    updateSortingColumnWidths = (columns: number[]) => {
        this.setState(state => {
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
        this.setState(state => {
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
                        ...state.columns.map(c => {
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
            state => {
                if (state.columns === undefined) return state;

                return update(state, {
                    columns: {
                        $set: state.columns.map(column => {
                            if (column.field === columnId) {
                                return {
                                    ...column,
                                    direction:
                                        column.direction === ColumnDirection.ASCENDING
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

    onContextMenuItemClick = (item: ResourceType, menuItemId?: string) => {
        const selectedItems = this.getSelectedItems();
        this.props.rowHandlers?.onContextMenuItemClick?.(item, menuItemId, selectedItems);
    };

    onDrop = (targetItemId: string, targetItemType: string) => {
        const selectedItems = this.getSelectedItems();
        this.props.rowHandlers?.onDrop?.(targetItemId, targetItemType, selectedItems);
    };

    onItemClick = async (
        e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
        item: ResourceType,
        rightClick?: boolean,
        dragged?: boolean
    ) => {
        // @ts-ignore
        if (e.target?.classList?.contains("clickable")) return;

        this.props.rowHandlers?.onClick?.(e, item, rightClick, dragged);

        const afterStateUpdate = () => this.props.rowHandlers?.onSelect?.(this.getSelectedItems());

        if (e.ctrlKey) {
            this.setState(state => {
                return {
                    selectedItems: {
                        ...state.selectedItems,
                        [item._id]: state.selectedItems[item._id] ? false : true
                    }
                };
            }, afterStateUpdate);
        } else if (e.shiftKey) {
            const toBeSet = await (async () => {
                const state = this.state;
                const selectedItems = cloneDeep(state.selectedItems);
                const noneSelected = Object.keys(selectedItems).every(id => !selectedItems[id]);

                if (noneSelected) {
                    selectedItems[item._id] = true;
                    return selectedItems;
                }

                const startIndex = this.state.items.findIndex(
                    i => i?._id === Object.keys(selectedItems).find(id => selectedItems[id])
                );

                const endIndex = this.state.items.findIndex(i => i?._id === item._id);

                const minIndex = Math.min(startIndex, endIndex);
                const maxIndex = Math.max(startIndex, endIndex);

                const allToBeSelectedLoaded = this.isItemRangeLoaded(minIndex, maxIndex);

                if (!allToBeSelectedLoaded) {
                    const newItems = await this.loadMoreItems(minIndex, maxIndex - minIndex + 1);
                    newItems?.forEach((item, index) => {
                        if (item) {
                            selectedItems[item._id] = true;
                        } else {
                            throw new Error(
                                `Internal Error: Could not select all items because at least one of them is not loaded: ${index}, this should not happen, please report this.`
                            );
                        }
                    });
                } else {
                    for (let i = minIndex; i <= maxIndex; i++) {
                        const indexer = this.state.items[i]?._id;
                        if (indexer) {
                            selectedItems[indexer] = true;
                        } else {
                            throw new Error(
                                `Internal Error: Could not select all items because at least one of them is not loaded: ${i}, this should not happen, please report this.`
                            );
                        }
                    }
                }

                return selectedItems;
            })();

            this.setState(state => {
                return update(state, {
                    selectedItems: {
                        $set: toBeSet
                    }
                });
            }, afterStateUpdate);
        } else if (rightClick || dragged) {
            const selectedItems = this.getSelectedItems();
            if (selectedItems.length <= 1) {
                this.setState({
                    selectedItems: {
                        [item._id]: true
                    }
                });
            }
        } else {
            this.setState(
                {
                    selectedItems: {
                        [item._id]: true
                    }
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
        return Object.entries(this.state.selectedItems).flatMap(([itemId, selected]) => {
            if (!selected) return [];
            const item = this.state.items.find(item => item?._id === itemId);
            return item ? [item] : [];
        });
    };

    updateColumnVisibility = (columnId: string, visible: boolean) => {
        this.setState(state => {
            if (!state.columns) return state;
            return update(state, {
                columns: {
                    $set: state.columns.map(column => {
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
        const currentRowRenderer = this.props.rowRenderers.find(
            rowRenderer => rowRenderer.name === this.state.listType
        );

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
        const currentRowRenderer = this.props.rowRenderers.find(
            rowRenderer => rowRenderer.name === this.state.listType
        );

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

        const currentRowRenderer = this.props.rowRenderers.find(
            rowRenderer => rowRenderer.name === this.state.listType
        );

        if (!currentRowRenderer) return <></>;

        const itemCount = currentRowRenderer.getRowCount(
            fullListLength,
            this.state.gridColumnCount
        );

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
                {this.props.displaySortingBar !== false && this.state.columns && (
                    <SortingBar
                        resourceListId={this.props.id ?? ""}
                        columns={this.state.columns}
                        updateColumnDirections={this.updateColumnDirections}
                        updateSortingColumnWidths={this.updateSortingColumnWidths}
                        updateColumnVisibility={this.updateColumnVisibility}
                        createColumn={this.createColumn}
                    />
                )}
                <div
                    style={{
                        width: "100%",
                        height: `calc(100% - ${barHeights}px)`
                    }}
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
                                >
                                    {({ onItemsRendered, ref }) => {
                                        const rowHeight = currentRowRenderer.getRowHeight(
                                            width,
                                            height,
                                            this.state.gridColumnCount
                                        );

                                        return (
                                            <FixedSizeList
                                                itemKey={this.getItemKey}
                                                itemSize={rowHeight}
                                                height={height}
                                                onScroll={this.onScroll}
                                                overscanCount={5}
                                                itemCount={itemCount}
                                                width={width}
                                                onItemsRendered={onItemsRendered}
                                                ref={ref}
                                                // without this the context menu cannot be positioned fixed
                                                // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                                style={{ willChange: "none", overflowY: "scroll" }}
                                                layout={
                                                    currentRowRenderer.direction ===
                                                    RowRendererDirection.Horizontal
                                                        ? "horizontal"
                                                        : "vertical"
                                                }
                                                itemData={{
                                                    items: this.state.items,
                                                    total_count: this.state.total_count,
                                                    handlers: {
                                                        //@ts-ignore TODO fix this
                                                        onItemClick: this.onItemClick,
                                                        onDrop: this.onDrop,
                                                        onContextMenuItemClick:
                                                            this.onContextMenuItemClick
                                                    },
                                                    functions: {
                                                        getSelectedItems: this.getSelectedItems
                                                    },
                                                    selectedItems: this.state.selectedItems,

                                                    //@ts-ignore TODO fix this
                                                    columns: this.state.columns,
                                                    disableContextMenu:
                                                        this.props.disableContextMenu,
                                                    //TODO fix this
                                                    menuItems: this.state.menuItems,
                                                    resourceType: this.props.resourceType,
                                                    gridColumnCount: this.state.gridColumnCount,
                                                    rowHeight,
                                                    rowHandlers: this.props.rowHandlers
                                                }}
                                            >
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
