import update from "immutability-helper";
import { cloneDeep } from "lodash";
import { CSSProperties, JSX, PureComponent, createRef } from "react";
//@ts-ignore
import { SortDirection } from "filez-client-typescript";
import "react-contexify/dist/ReactContexify.css";
import AutoSizer from "react-virtualized-auto-sizer";
import { List } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
import { FilezContext } from "../../../FilezContext";
import { MenuItems, defaultMenuItems } from "./DefaultContextMenuItems";
import ListTopBar from "./ListTopBar";
import {
    BaseResource,
    Column,
    ListResourceRequestBody,
    ListResourceResponseBody,
    ResourceListHandlers,
    ResourceListRowHandlers,
    RowRenderer,
    RowRendererDirection
} from "./ResourceListTypes";
import SortingBar from "./SortingBar";

const LoadItemMode = {
    Reload: "Reload",
    NewId: "NewId",
    All: "All"
} as const;

type LoadItemMode = (typeof LoadItemMode)[keyof typeof LoadItemMode];

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
    readonly getResourcesList: (
        listResourceRequestBody: ListResourceRequestBody
    ) => Promise<ListResourceResponseBody<ResourceType>>;

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
    readonly totalCount: number;
    readonly committedSearch: string;
    readonly columns?: Column<ResourceType>[];
    readonly listType: string;
    readonly menuItems: MenuItems;
    readonly selectedItems: (true | undefined)[];
    readonly lastSelectedItemIndex?: number;
    readonly arrowKeyShiftSelectItemIndex?: number;
    readonly gridColumnCount: number;
    readonly scrollOffset: number;
    readonly width: number | null;
    readonly height: number | null;
}

export default class ResourceList<ResourceType extends BaseResource> extends PureComponent<
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
            totalCount: 0,
            committedSearch: "",
            columns: cloneDeep(props.columns),
            listType: this.props.initialListType ?? this.props.rowRenderers[0].name,
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

    // TODO create deselect all function to call for higher order components to call when a resource was deleted for example

    componentDidUpdate = async (
        prevProps: Readonly<ResourceListProps<ResourceType>>,
        _prevState: Readonly<ResourceListState<ResourceType>>
    ) => {
        if (prevProps.id !== this.props.id || prevProps.resourceType !== this.props.resourceType) {
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

        const { sortBy: sortBy, sortDirection: sortDirection } = this.getCurrentColumnSorting();

        const currentlyVisibleItemRange = this.getCurrentVisibleItemsRange(
            mode === LoadItemMode.NewId ? 0 : this.state.scrollOffset
        );

        let { startIndex, limit } = currentRowRenderer.getStartIndexAndLimit(
            currentlyVisibleItemRange.startIndex,
            currentlyVisibleItemRange.endIndex - currentlyVisibleItemRange.startIndex + 1,
            this.state.gridColumnCount
        );

        if (mode === LoadItemMode.All) {
            startIndex = 0;
            limit = this.state.totalCount;
        }

        this.moreItemsLoading = true;
        const { items: newItems, totalCount } = await this.props.getResourcesList({
            fromIndex: startIndex,
            limit,
            sortBy,
            sortDirection
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

            return { items, totalCount, selectedItems };
        });
    };

    getCurrentColumnSorting = (): {
        sortBy: string;
        sortDirection: SortDirection;
    } => {
        const columns = this.state.columns;
        if (!columns) {
            return {
                sortBy: this.props.defaultSortField,
                sortDirection: SortDirection.Ascending
            };
        }
        for (const column of columns) {
            if (column.direction !== SortDirection.Neutral) {
                return {
                    sortBy: column.field,
                    sortDirection: column.direction
                };
            }
        }
        return {
            sortBy: this.props.defaultSortField,
            sortDirection: SortDirection.Ascending
        };
    };

    loadMoreItems = async (startIndex: number, endIndex: number) => {
        let limit = endIndex - startIndex + 1;
        //if (this.moreItemsLoading) return;
        const { sortBy, sortDirection } = this.getCurrentColumnSorting();

        const currentRowRenderer = this.getCurrentRowRenderer();
        if (!currentRowRenderer) return;

        const startIndexAndLimit = currentRowRenderer.getStartIndexAndLimit(
            startIndex,
            limit,
            this.state.gridColumnCount
        );
        startIndex = startIndexAndLimit.startIndex;
        limit = startIndexAndLimit.limit;

        // TODO this is triggering a lot of unnecessary requests when dragging down the scrollbar
        //if (startIndex === this.lastStartIndex) return;

        //this.moreItemsLoading = true;
        //this.lastStartIndex = startIndex;
        const { items: newItems } = await this.props.getResourcesList({
            fromIndex: startIndex,
            limit,
            sortBy,
            sortDirection
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
                direction: SortDirection.Neutral,
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
                                        column.direction === SortDirection.Ascending
                                            ? SortDirection.Descending
                                            : SortDirection.Ascending
                                };
                            } else {
                                return {
                                    ...column,
                                    direction: SortDirection.Neutral
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
        this.setState({ committedSearch: search }, () => {
            this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
            this.loadItems(LoadItemMode.NewId);
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
        this.props.rowHandlers?.onDrop?.(targetItemId, targetItemType, selectedItems);
    };

    onItemClick = async (
        e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
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
            const currentSelectionState = this.state.selectedItems[index];
            selectedItems[index] = currentSelectionState === true ? undefined : true;

            const lastSelectedItemIndex = (() => {
                if (index === this.state.lastSelectedItemIndex || currentSelectionState) {
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
                    return selected === undefined;
                });

                if (noneSelected) {
                    //@ts-ignore
                    selectedItems[index] = true;
                    return selectedItems;
                }

                const startIndex = this.state.lastSelectedItemIndex ?? 0;

                const endIndex = index;

                const minIndex = Math.min(startIndex, endIndex);
                const maxIndex = Math.max(startIndex, endIndex);

                const allToBeSelectedLoaded = this.isItemRangeLoaded(minIndex, maxIndex);

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
                selectedItems.find((selectedItem) => selectedItem.id === item.id) !== undefined;

            if (!currentItemInSelectedItems) {
                const newSelectedItems: (true | undefined)[] = [];
                newSelectedItems[index] = true;
                this.setState({
                    selectedItems: newSelectedItems,
                    lastSelectedItemIndex: index
                });
            }
        } else {
            const selectedItems: (true | undefined)[] = [];
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

    updateDimensions = ({
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

    getLastSelectedItem = () => {
        const index = this.state.lastSelectedItemIndex;
        if (index === undefined) return undefined;
        return this.state.items[index];
    };

    handleCommonHotkeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey) {
            if (e.key === "a") {
                e.preventDefault();
                this.setState(
                    {
                        selectedItems: new Array(this.state.totalCount).fill(true)
                    },
                    async () => {
                        await this.loadItems(LoadItemMode.All);
                        this.props.handlers?.onSelect?.(
                            this.getSelectedItems(),
                            this.state.items[this.state.lastSelectedItemIndex ?? 0]
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

        const selectedItemsAfterKeypress = currentRowRenderer?.getSelectedItemsAfterKeypress(
            e,
            this.state.items,
            this.state.totalCount,
            this.state.selectedItems,
            this.state.lastSelectedItemIndex,
            this.state.arrowKeyShiftSelectItemIndex,
            this.state.gridColumnCount
        );

        if (selectedItemsAfterKeypress === undefined) return;

        const { scrollToRowIndex, nextSelectedItemIndex, arrowKeyShiftSelectItemIndex } =
            selectedItemsAfterKeypress;

        const selectedItems = (() => {
            const s: (true | undefined)[] = [];
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
        const fullListLength = this.state.totalCount;

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
        const minimumBatchSize = Math.max(Math.min(20, this.state.totalCount / 1000), 1000);
        const loadMoreItemsThreshold = minimumBatchSize / 2;

        return (
            <div className="Filez ResourceList" style={{ ...this.props.style }}>
                {this.props.displayTopBar !== false && (
                    <ListTopBar
                        items={this.state.items}
                        total_count={this.state.totalCount}
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
                    className="OuterResourceList"
                    tabIndex={0}
                    onKeyDown={this.onListKeyDown}
                >
                    <AutoSizer onResize={this.updateDimensions}>
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
                                        const rowHeight = currentRowRenderer.getRowHeight(
                                            width,
                                            height,
                                            this.state.gridColumnCount
                                        );

                                        return (
                                            <List
                                                outerRef={this.listOuterRef}
                                                itemKey={this.getItemKey}
                                                itemSize={rowHeight}
                                                height={height}
                                                // @ts-ignore
                                                onScroll={this.onScroll}
                                                overscanCount={5}
                                                itemCount={itemCount}
                                                width={width}
                                                onItemsRendered={onItemsRendered}
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
                                                    total_count: this.state.totalCount,
                                                    dropTargetAcceptsTypes:
                                                        this.props.dropTargetAcceptsTypes,
                                                    handlers: {
                                                        //@ts-ignore TODO fix this
                                                        onItemClick: this.onItemClick,
                                                        onDrop: this.onDrop,
                                                        onContextMenuItemClick:
                                                            this.onContextMenuItemClick
                                                    },
                                                    functions: {
                                                        getSelectedItems: this.getSelectedItems,
                                                        getLastSelectedItem:
                                                            this.getLastSelectedItem
                                                    },
                                                    selectedItems: this.state.selectedItems,
                                                    lastSelectedItemIndex:
                                                        this.state.lastSelectedItemIndex,

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
                                                {/*@ts-ignore*/}
                                                {currentRowRenderer.component}
                                            </List>
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

export const getSelectedCount = (selectedItems: (boolean | undefined)[], total_count: number) => {
    let count = 0;
    for (let i = 0; i < total_count; i++) {
        if (selectedItems[i] === true) {
            count++;
        }
    }

    return count;
};
