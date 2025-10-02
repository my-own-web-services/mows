import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { SortDirection } from "filez-client-typescript";
import update from "immutability-helper";
import { cloneDeep } from "lodash";
import React, { CSSProperties, JSX, PureComponent, createRef } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
import {
    BaseResource,
    ListResourceRequestBody,
    ListResourceResponseBody,
    ListRowHandler,
    ResourceListHandlers,
    RowRendererDirection
} from "./ResourceListTypes";

export enum LoadItemMode {
    Reload,
    NewId,
    All
}

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
    readonly displaySortingBar?: boolean;

    /**
     * The number of items to render outside of the visible area. This can help with smoother scrolling.
     * Default is 20.
     */
    readonly overscanCount?: number;
    readonly listHeaderElement?: JSX.Element;
    readonly id?: string;
    readonly handlers?: ResourceListHandlers<FilezResourceType>;
    readonly dropTargetAcceptsTypes?: string[];
}

interface ResourceListState<ResourceType> {
    readonly resources: (ResourceType | undefined)[];
    readonly totalCount: number;
    readonly committedSearch: string;
    readonly selectedItems: (true | undefined)[];

    readonly lastSelectedItemIndex?: number;
    readonly arrowKeyShiftSelectItemIndex?: number;
    readonly gridColumnCount: number;
    readonly scrollOffset: number;
    readonly width: number | null;
    readonly height: number | null;
    readonly sortBy: string;
    readonly sortDirection: SortDirection;
}

export default class ResourceList<ResourceType extends BaseResource> extends PureComponent<
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
    currentRowHandler: ListRowHandler<ResourceType>;

    constructor(props: ResourceListProps<ResourceType>) {
        super(props);
        this.contextMenuRender = <></>;

        this.state = {
            resources: [],
            totalCount: 0,
            committedSearch: "",
            selectedItems: [],
            gridColumnCount: 10,
            scrollOffset: 0,
            width: null,
            height: null,
            sortBy: this.props.defaultSortBy ?? "CreatedTime",
            sortDirection: this.props.defaultSortDirection ?? SortDirection.Descending
        };

        this.currentRowHandler = this.setNewRowHandler(this.props.initialRowHandler);

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

        const rowHeight = this.currentRowHandler.getRowHeight(
            width,
            height,
            this.state.gridColumnCount
        );
        const startIndex = Math.floor(scrollOffset / rowHeight);
        const endIndex = Math.ceil((scrollOffset + height) / rowHeight);

        return { startIndex, endIndex };
    };

    loadItems = async (mode?: LoadItemMode) => {
        log.debug("loadItems called with mode:", mode);
        if (mode === LoadItemMode.NewId) {
            //@ts-ignore
            this.infiniteLoaderRef.current._listRef.scrollToItem(0);
        }

        const currentlyVisibleItemRange = this.getCurrentVisibleItemsRange(
            mode === LoadItemMode.NewId ? 0 : this.state.scrollOffset
        );

        let { startIndex, limit } = this.currentRowHandler.getStartIndexAndLimit(
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

            return { resources: items, totalCount, selectedItems };
        });
    };

    loadMoreItems = async (startIndex: number, endIndex: number) => {
        let limit = endIndex - startIndex + 1;
        //if (this.moreItemsLoading) return;

        const startIndexAndLimit = this.currentRowHandler.getStartIndexAndLimit(
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
        return this.currentRowHandler.isItemLoaded(
            this.state.resources,
            index,
            this.state.gridColumnCount
        );
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
        return this.currentRowHandler?.getItemKey(
            this.state.resources,
            index,
            this.state.gridColumnCount
        );
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

    setNewRowHandler = (rowHandlerId: string) => {
        const rowHandler = this.props.rowHandlers.find((r) => r.name === rowHandlerId);

        if (rowHandler) {
            this.currentRowHandler = rowHandler;
            //@ts-ignore
            this.currentRowHandler.resourceList = this;
            return rowHandler;
        }

        throw new Error(`No row handler found with name ${this.props.initialRowHandler}`);
    };

    getLastSelectedItem = () => {
        const index = this.state.lastSelectedItemIndex;
        if (index === undefined) return undefined;
        return this.state.resources[index];
    };

    selectAll = async () => {
        this.setState(
            {
                selectedItems: new Array(this.state.totalCount).fill(true)
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
                selectedItems: new Array(this.state.totalCount).fill(false)
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

        const selectedItemsAfterKeypress = this.currentRowHandler.getSelectedItemsAfterKeypress(
            e,
            this.state.resources,
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
                    this.state.resources[this.state.lastSelectedItemIndex ?? 0]
                );
            }
        );

        // scroll to the new selected item
        // @ts-ignore
        this.infiniteLoaderRef.current._listRef.scrollToItem(scrollToRowIndex);
    };

    render = () => {
        const fullListLength = this.state.totalCount;

        const itemCount = this.currentRowHandler.getRowCount(
            fullListLength,
            this.state.gridColumnCount
        );

        // TODO this should be adjusted depending on the row renderer
        const minimumBatchSize = Math.max(Math.min(20, this.state.totalCount / 1000), 1000);
        const loadMoreItemsThreshold = minimumBatchSize / 2;

        return (
            <div
                className={cn(`ResourceList flex h-full w-full flex-col`, this.props.className)}
                style={{ ...this.props.style }}
            >
                {this.currentRowHandler.headerRenderer?.()}
                <div
                    className="OuterResourceList h-full w-full focus:outline-none"
                    onKeyDown={this.onListKeyDown}
                    tabIndex={0}
                >
                    <AutoSizer
                        style={{ width: "100%", height: "100%" }}
                        onResize={this.updateDimensions}
                    >
                        {({ height, width }) => {
                            return (
                                <InfiniteLoader
                                    isItemLoaded={this.isItemLoaded}
                                    itemCount={itemCount}
                                    loadMoreItems={this.loadMoreItems}
                                    //@ts-ignore
                                    ref={this.infiniteLoaderRef}
                                    minimumBatchSize={minimumBatchSize}
                                    threshold={loadMoreItemsThreshold}
                                >
                                    {({ onItemsRendered, ref }) => {
                                        const rowHeight = this.currentRowHandler.getRowHeight(
                                            width,
                                            height,
                                            this.state.gridColumnCount
                                        );

                                        return (
                                            <FixedSizeList
                                                outerRef={this.listOuterRef}
                                                itemSize={rowHeight}
                                                itemKey={this.getItemKey}
                                                // @ts-ignore
                                                onScroll={this.onScroll}
                                                overscanCount={this.props.overscanCount ?? 100}
                                                width={width}
                                                height={height}
                                                itemCount={itemCount}
                                                onItemsRendered={onItemsRendered}
                                                ref={ref}
                                                // without this the context menu cannot be positioned fixed
                                                // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                                style={{
                                                    willChange: "none",
                                                    overflowY: "scroll"
                                                }}
                                                layout={
                                                    this.currentRowHandler.direction ===
                                                    RowRendererDirection.Horizontal
                                                        ? "horizontal"
                                                        : "vertical"
                                                }
                                                itemData={{
                                                    items: this.state.resources,
                                                    total_count: this.state.totalCount,
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
                                                    gridColumnCount: this.state.gridColumnCount,
                                                    rowHeight,
                                                    rowHandlers: this.props.rowHandlers
                                                }}
                                            >
                                                {/*@ts-ignore*/}
                                                {this.currentRowHandler.rowRenderer}
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

export const getSelectedCount = (selectedItems?: (boolean | undefined)[]) => {
    if (selectedItems === undefined) return 0;
    let count = 0;
    for (let i = 0; i < selectedItems.length; i++) {
        if (selectedItems[i] === true) {
            count++;
        }
    }

    return count;
};
