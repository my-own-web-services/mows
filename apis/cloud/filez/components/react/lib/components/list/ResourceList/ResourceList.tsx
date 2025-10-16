import ButtonSelect from "@/components/atoms/ButtonSelect/ButtonSelect";
import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { SortDirection } from "filez-client-typescript";
import update from "immutability-helper";
import cloneDeep from "lodash/cloneDeep";
import React, { CSSProperties, Component, JSX, createRef } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
import {
    BaseResource,
    ListResourceRequestBody,
    ListResourceResponseBody,
    ListRowHandler,
    LoadItemMode,
    ResourceListHandlers,
    RowRendererDirection
} from "./ResourceListTypes";
import { getSelectedCount, getSelectedItems } from "./utils";

interface ResourceListProps<FilezResourceType> {
    /**
     The type of the resource to be displayed.
     */
    readonly resourceType: string;

    /**
     The available row handlers
     */
    readonly rowHandlers: ListRowHandler<FilezResourceType>[];

    /**
     * The initial row handler to use. This has to match one of the names of the provided row handlers.
     */
    readonly initialRowHandler: string;

    /**
     A function that gets the resource in from the server/db and returns it. This has to be implemented in a specific way to support the infinite scrolling.
     */
    readonly getResourcesList: (
        listResourceRequestBody: ListResourceRequestBody
    ) => Promise<ListResourceResponseBody<FilezResourceType>>;

    readonly style?: CSSProperties;
    readonly className?: string;

    /**
     The default field to sort the list by.
     */
    readonly defaultSortBy?: string;
    /**
     The default direction to sort the list by.
     */
    readonly defaultSortDirection?: SortDirection;

    readonly displayListHeader?: boolean;

    /**
     * The number of items to render outside of the visible area. This can help with smoother scrolling.
     * Default is 20.
     */
    readonly overscanCount?: number;
    readonly listHeaderElement?: JSX.Element;
    readonly id?: string;
    readonly handlers?: ResourceListHandlers<FilezResourceType>;
    readonly dropTargetAcceptsTypes?: string[];

    readonly displayDebugBar?: boolean;
}

interface ResourceListState<ResourceType> {
    readonly resources: (ResourceType | undefined)[];
    readonly totalItemCount: number;
    readonly committedSearch: string;
    readonly selectedItems: (true | undefined)[];

    readonly lastSelectedItemIndex?: number;
    readonly arrowKeyShiftSelectItemIndex?: number;
    readonly scrollOffset: number;
    readonly width: number | null;
    readonly height: number | null;
    readonly sortBy: string;
    readonly sortDirection: SortDirection;
    readonly currentRowHandler: ListRowHandler<ResourceType>;
}

export default class ResourceList<ResourceType extends BaseResource> extends Component<
    ResourceListProps<ResourceType>,
    ResourceListState<ResourceType>
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    infiniteLoaderRef = createRef<typeof InfiniteLoader>();
    listOuterRef = createRef<HTMLDivElement>();
    moreItemsLoading = false;
    lastStartIndex = 0;
    contextMenuRender: JSX.Element;

    constructor(props: ResourceListProps<ResourceType>) {
        super(props);
        this.contextMenuRender = <></>;

        this.state = {
            resources: [],
            totalItemCount: 0,
            committedSearch: "",
            selectedItems: [],
            scrollOffset: 0,
            width: null,
            height: null,
            sortBy: this.props.defaultSortBy ?? "CreatedTime",
            sortDirection: this.props.defaultSortDirection ?? SortDirection.Descending,
            currentRowHandler: this.getRowHandlerById(this.props.initialRowHandler)!
        };

        log.debug("ResourceList initial state:", this.state);
    }

    componentDidMount = async () => {
        log.debug("ResourceList componentDidMount called");
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
        const { width, height } = this.state;
        if (width === null || height === null) return { startIndex: 0, endIndex: 30 };

        const rowHeight = this.state.currentRowHandler.getRowHeight(width, height);
        const startIndex = Math.floor(scrollOffset / rowHeight);
        const endIndex = Math.ceil((scrollOffset + height) / rowHeight);

        return { startIndex, endIndex };
    };

    loadItems = async (mode?: LoadItemMode) => {
        log.debug("loadItems called with mode:", mode);
        if (mode === LoadItemMode.NewId) {
            this.scrollToRow(0);
        }

        const currentlyVisibleItemRange = this.getCurrentVisibleItemsRange(
            mode === LoadItemMode.NewId ? 0 : this.state.scrollOffset
        );

        let { startIndex, limit } = this.state.currentRowHandler.getStartIndexAndLimit(
            currentlyVisibleItemRange.startIndex,
            currentlyVisibleItemRange.endIndex - currentlyVisibleItemRange.startIndex + 1
        );

        if (mode === LoadItemMode.All) {
            startIndex = 0;
            limit = this.state.totalItemCount;
        }

        this.moreItemsLoading = true;

        const { items: newItems, totalCount } = await this.props.getResourcesList({
            fromIndex: startIndex,
            limit,
            sortBy: this.state.sortBy,
            sortDirection: this.state.sortDirection
        });

        this.moreItemsLoading = false;

        this.setState(({ resources: items, selectedItems }) => {
            if (mode === LoadItemMode.NewId || mode === LoadItemMode.Reload) {
                items = [];
            }
            for (let i = 0; i < newItems.length; i++) {
                items[startIndex + i] = newItems[i];
            }

            if (mode === LoadItemMode.NewId) {
                selectedItems = [];
            }

            log.debug("Updated items and selectedItems in state:", {
                itemsLength: items.length,
                selectedItemsLength: selectedItems.length
            });

            return { resources: items, totalItemCount: totalCount, selectedItems };
        });
    };

    loadMoreItems = async (startIndex: number, endIndex: number) => {
        let limit = endIndex - startIndex + 1;
        //if (this.moreItemsLoading) return;

        const startIndexAndLimit = this.state.currentRowHandler.getStartIndexAndLimit(
            startIndex,
            limit
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
            sortBy: this.state.sortBy,
            sortDirection: this.state.sortDirection
        });
        //this.moreItemsLoading = false;

        const updatedItems = update(this.state.resources, {
            $apply: (currentItems: (ResourceType | undefined)[]) => {
                for (let i = 0; i < newItems.length; i++) {
                    currentItems[startIndex + i] = newItems[i];
                }
                return currentItems;
            }
        });

        this.setState({ resources: updatedItems });
    };

    commitSearch = (search: string) => {
        this.setState({ committedSearch: search }, () => {
            //@ts-ignore
            this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
            this.loadItems(LoadItemMode.NewId);
        });
    };

    refreshList = async () => {
        //@ts-ignore
        this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
        await this.loadItems(LoadItemMode.Reload);
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
        const { resources: items } = this.state;
        for (let i = startIndex; i < endIndex; i++) {
            if (items[i] === undefined) return false;
        }
        return true;
    };

    getSelectedItems = (): ResourceType[] => {
        return getSelectedItems(this.state.resources, this.state.selectedItems);
    };

    isItemLoaded = (index: number) => {
        return this.state.currentRowHandler.isItemLoaded(this.state.resources, index);
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
        return this.state.currentRowHandler?.getItemKey(this.state.resources, index);
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

    updateRowHandler = (rowHandlerId: string) => {
        const rowHandler = this.getRowHandlerById(rowHandlerId);
        this.setState({ currentRowHandler: rowHandler });
    };

    getRowHandlerById = (id: string) => {
        const rowHandler = this.props.rowHandlers.find((r) => r.id === id);
        if (!rowHandler)
            throw new Error(`No row handler found with name ${this.props.initialRowHandler}`);

        //@ts-ignore
        rowHandler.resourceList = this;
        return rowHandler;
    };

    getLastSelectedItem = () => {
        const index = this.state.lastSelectedItemIndex;
        if (index === undefined) return undefined;
        return this.state.resources[index];
    };

    selectAll = async () => {
        this.setState(
            {
                selectedItems: new Array(this.state.totalItemCount).fill(true)
            },
            async () => {
                await this.loadItems(LoadItemMode.All);
                this.props.handlers?.onSelect?.(
                    this.getSelectedItems(),
                    this.state.resources[this.state.lastSelectedItemIndex ?? 0]
                );
            }
        );
    };

    deselectAll = () => {
        this.setState(
            {
                selectedItems: new Array(this.state.totalItemCount).fill(false)
            },
            async () => {
                await this.loadItems(LoadItemMode.All);
                this.props.handlers?.onSelect?.(
                    this.getSelectedItems(),
                    this.state.resources[this.state.lastSelectedItemIndex ?? 0]
                );
            }
        );
    };

    handleCommonHotkeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey) {
            if (e.key === "a") {
                e.preventDefault();
                this.selectAll();
            }
        }
    };

    onListKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
        e.preventDefault();

        // TODO use a starting point when shift selecting for mouse selection like right now when selecting with the arrow keys and shift

        this.handleCommonHotkeys(e);

        const selectedItemsAfterKeypress =
            this.state.currentRowHandler.getSelectedItemsAfterKeypress(
                e,
                this.state.resources,
                this.state.totalItemCount,
                this.state.selectedItems,
                this.state.lastSelectedItemIndex,
                this.state.arrowKeyShiftSelectItemIndex
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
                    this.state.resources[this.state.lastSelectedItemIndex ?? 0]
                );
            }
        );

        this.scrollToRow(scrollToRowIndex);
    };

    scrollToRow = (index?: number) => {
        if (index === undefined) return;
        // @ts-ignore
        this.infiniteLoaderRef.current._listRef.scrollToItem(index);
    };

    debugBar = () => {
        if (this.props.displayDebugBar !== true) return null;
        return (
            <div className="DebugBar text-primary/30 flex gap-2 border-t-1 border-b-1 p-1 text-xs">
                <span>
                    {this.state.resources.length} / {this.state.totalItemCount} items loaded.
                </span>
                <span>{getSelectedCount(this.state.selectedItems)} items selected. </span>
                <span>Last selected item index: {this.state.lastSelectedItemIndex}</span>
                <span>Current Row Handler: {this.state.currentRowHandler.id}. </span>
                <span>
                    Current Sorting: {this.state.sortBy} ({SortDirection[this.state.sortDirection]}
                    ).
                </span>
            </div>
        );
    };

    listHeader = () => {
        if (this.props.displayListHeader === false) return null;
        if (this.props.listHeaderElement) return this.props.listHeaderElement;
        return (
            <div className="flex h-12 w-full items-center justify-end pr-4">
                {this.props.rowHandlers.length > 1 && (
                    <ButtonSelect
                        size={"icon-sm"}
                        onSelectionChange={(id: string) => {
                            log.debug("Switching row handler to", id);
                            this.updateRowHandler(id);
                        }}
                        selectedId={this.state.currentRowHandler.id}
                        options={this.props.rowHandlers.map((rowHandler) => {
                            return {
                                id: rowHandler.id,
                                icon: rowHandler.icon,
                                label: rowHandler.name
                            };
                        })}
                    />
                )}
            </div>
        );
    };

    render = () => {
        const totalRowCount = this.state.currentRowHandler.getRowCount(this.state.totalItemCount);

        const minimumBatchSize = this.state.currentRowHandler.getMinimumBatchSize(
            this.state.totalItemCount
        );
        const loadMoreItemsThreshold = this.state.currentRowHandler.getLoadMoreItemsThreshold(
            this.state.totalItemCount
        );

        return (
            <div
                className={cn(`ResourceList flex h-full w-full flex-col`, this.props.className)}
                style={{ ...this.props.style }}
            >
                {this.listHeader()}
                {this.state.currentRowHandler.headerRenderer?.()}
                <div
                    className="OuterResourceList h-full w-full focus:outline-none"
                    onKeyDown={this.onListKeyDown}
                    tabIndex={0}
                >
                    <AutoSizer onResize={this.updateDimensions}>
                        {({ height, width }) => {
                            return (
                                <InfiniteLoader
                                    isItemLoaded={this.isItemLoaded}
                                    itemCount={totalRowCount}
                                    loadMoreItems={this.loadMoreItems}
                                    //@ts-ignore
                                    ref={this.infiniteLoaderRef}
                                    minimumBatchSize={minimumBatchSize}
                                    threshold={loadMoreItemsThreshold}
                                >
                                    {({ onItemsRendered, ref }) => {
                                        const rowHeight = this.state.currentRowHandler.getRowHeight(
                                            width,
                                            height
                                        );

                                        return (
                                            <FixedSizeList
                                                outerRef={this.listOuterRef}
                                                itemSize={rowHeight}
                                                itemKey={this.getItemKey}
                                                // @ts-ignore
                                                onScroll={this.onScroll}
                                                overscanCount={this.props.overscanCount ?? 20}
                                                width={width}
                                                height={height}
                                                itemCount={totalRowCount}
                                                onItemsRendered={onItemsRendered}
                                                ref={ref}
                                                // without this the context menu cannot be positioned fixed
                                                // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                                style={{
                                                    willChange: "none",
                                                    overflowY: "scroll"
                                                }}
                                                layout={
                                                    this.state.currentRowHandler.direction ===
                                                    RowRendererDirection.Horizontal
                                                        ? "horizontal"
                                                        : "vertical"
                                                }
                                                itemData={{
                                                    items: this.state.resources,
                                                    total_count: this.state.totalItemCount,
                                                    dropTargetAcceptsTypes:
                                                        this.props.dropTargetAcceptsTypes,
                                                    handlers: {
                                                        onItemClick: this.onItemClick
                                                    },
                                                    functions: {
                                                        getSelectedItems: this.getSelectedItems,
                                                        getLastSelectedItem:
                                                            this.getLastSelectedItem
                                                    },
                                                    selectedItems: this.state.selectedItems,
                                                    lastSelectedItemIndex:
                                                        this.state.lastSelectedItemIndex,

                                                    resourceType: this.props.resourceType,
                                                    rowHeight,
                                                    rowHandlers: this.props.rowHandlers
                                                }}
                                            >
                                                {/*@ts-ignore*/}
                                                {this.state.currentRowHandler.rowRenderer}
                                            </FixedSizeList>
                                        );
                                    }}
                                </InfiniteLoader>
                            );
                        }}
                    </AutoSizer>
                </div>
                {this.debugBar()}
            </div>
        );
    };
}
