import { GetResourceParams } from "@firstdorsal/filez-client";
import { SortOrder } from "@firstdorsal/filez-client/dist/js/apiTypes/SortOrder";
import { CSSProperties, ComponentType, PureComponent, ReactElement, createRef } from "react";
import InfiniteLoader from "react-window-infinite-loader";
import update from "immutability-helper";
import SortingBar from "./SortingBar";
import { FixedSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import ListTopBar from "./ListTopBar";
import { cloneDeep } from "lodash";
import { FilezContext } from "../../../FilezProvider";
import "react-contexify/dist/ReactContexify.css";
import { FilezMenuItems, defaultMenuItems } from "./DefaultMenuItems";

export interface RowRenderer<ResourceType> {
    readonly name: string;
    readonly icon: JSX.Element;
    readonly component: ComponentType<ListRowProps<ResourceType>>;
    readonly getRowHeight: (width: number, height: number, gridColumnCount: number) => number;
    readonly getRowCount: (itemCount: number, gridColumnCount: number) => number;
    readonly direction: RowRendererDirection;
    readonly isItemLoaded: (
        items: ResourceType[],
        index: number,
        gridColumnCount: number
    ) => boolean;
    readonly getItemKey: (items: ResourceType[], index: number, gridColumnCount: number) => number;
    readonly getStartIndexAndLimit?: (
        startIndex: number,
        limit: number,
        gridColumnCount: number
    ) => { startIndex: number; limit: number };
}

export interface RowHandlers {
    readonly onClick?: (
        e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
        item: BaseResource,
        rightClick?: boolean
    ) => void;
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
    readonly items: ResourceType[];
    readonly handlers: {
        readonly onItemClick: InstanceType<typeof ResourceList>["onItemClick"];
        readonly getSelectedItems: InstanceType<typeof ResourceList>["getSelectedItems"];
        readonly updateRenderModalName?: InstanceType<typeof ResourceList>["updateRenderModalName"];
    };
    readonly selectedItems: SelectedItems;
    readonly columns?: Column<ResourceType>[];
    readonly disableContextMenu?: boolean;
    readonly menuItems: FilezMenuItems<ResourceType>[];
    readonly resourceType: string;
    readonly gridColumnCount: number;
    readonly rowHeight: number;
    readonly rowHandlers?: RowHandlers;
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
        props: GetResourceParams
    ) => Promise<{ items: ResourceType[]; total_count: number }>;
    /**
    If provided renders a button to call it as well as the UI rendered by the function to create the resource.
    */
    readonly createResource?: ReactElement<any, any>;
    readonly editResource?: ReactElement<any, any>;
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly topBar?: JSX.Element;
    readonly id?: string;
    readonly columns?: Column<ResourceType>[];
    readonly disableContextMenu?: boolean;
    readonly initialListType?: string;
    readonly rowHandlers?: RowHandlers;
}

interface ResourceListState<ResourceType> {
    readonly items: ResourceType[];
    readonly total_count: number;
    readonly commitedSearch: string;
    readonly columns?: Column<ResourceType>[];
    readonly listType: string;
    readonly menuItems: FilezMenuItems<ResourceType>[];
    readonly selectedItems: SelectedItems;
    readonly renderModalName: string;
    readonly gridColumnCount: number;
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
            renderModalName: "",
            gridColumnCount: 10
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
            await this.loadItems();
            this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
        }
    };

    loadItems = async () => {
        const { sort_field, sort_order } = this.get_current_column_sorting();

        this.moreItemsLoading = true;
        const { items, total_count } = await this.props.get_items_function({
            id: this.props.id,
            from_index: 0,
            limit: 30,
            sort_field,
            sort_order,
            filter: this.state.commitedSearch
        });
        this.moreItemsLoading = false;

        this.setState({ items, total_count });
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

        if (currentRowRenderer.getStartIndexAndLimit) {
            const sial = currentRowRenderer.getStartIndexAndLimit(
                startIndex,
                limit,
                this.state.gridColumnCount
            );
            startIndex = sial.startIndex;
            limit = sial.limit;
        }

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
                //this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
                this.loadItems();
            }
        );
    };

    updateListType = (listType: string) => {
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
        await this.loadItems();
    };

    onItemClick = (
        e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
        item: BaseResource,
        rightClick?: boolean
    ) => {
        // @ts-ignore
        if (e.target?.classList?.contains("clickable")) return;

        this.props.rowHandlers?.onClick?.(e, item, rightClick);

        if (e.ctrlKey) {
            this.setState(state => {
                return {
                    selectedItems: {
                        ...state.selectedItems,
                        [item._id]: state.selectedItems[item._id] ? false : true
                    }
                };
            });
        } else if (e.shiftKey) {
            this.setState(state => {
                return update(state, {
                    selectedItems: {
                        $set: (() => {
                            const selectedItems = cloneDeep(state.selectedItems);
                            const noneSelected = Object.keys(selectedItems).every(
                                id => !selectedItems[id]
                            );

                            if (noneSelected) {
                                selectedItems[item._id] = true;
                                return selectedItems;
                            }

                            const items = state.items;
                            const startIndex = items.findIndex(
                                i =>
                                    i._id ===
                                    Object.keys(selectedItems).find(id => selectedItems[id])
                            );
                            const endIndex = items.findIndex(i => i._id === item._id);
                            const minIndex = Math.min(startIndex, endIndex);
                            const maxIndex = Math.max(startIndex, endIndex);
                            for (let i = minIndex; i <= maxIndex; i++) {
                                selectedItems[items[i]._id] = true;
                            }
                            return selectedItems;
                        })()
                    }
                });
            });
        } else if (rightClick) {
            const selectedItems = this.getSelectedItems();
            if (selectedItems.length <= 1) {
                this.setState({
                    selectedItems: {
                        [item._id]: true
                    }
                });
            }
        } else {
            this.setState({
                selectedItems: {
                    [item._id]: true
                }
            });
        }
    };

    getSelectedItems = (): ResourceType[] => {
        return Object.entries(this.state.selectedItems).flatMap(([itemId, selected]) => {
            if (!selected) return [];
            const item = this.state.items.find(item => item._id === itemId);
            return item ? [item] : [];
        });
    };

    updateColumnVisibility = (columnId: string, visible: boolean) => {
        console.log("updateColumnVisibility", columnId, visible);

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

    updateRenderModalName = (renderModalName: string) => {
        this.setState({ renderModalName });
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
        return this.state.items[index]._id;
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
                {(() => {
                    const mi = this.state.menuItems.filter(
                        menuItem => menuItem.name === this.state.renderModalName
                    )[0];

                    return (
                        mi &&
                        mi.render &&
                        mi.render({
                            items: this.state.items.filter(
                                item => this.state.selectedItems[item._id] === true
                            ),
                            resourceType: this.props.resourceType,
                            handleClose: () => {
                                this.setState({ renderModalName: "" });
                            },
                            editResource: this.props.editResource,
                            filezClient: this.context.filezClient,
                            refreshList: this.refreshList
                        })
                    );
                })()}
                {this.props.displayTopBar !== false && (
                    <ListTopBar
                        items={this.state.items}
                        total_count={this.state.total_count}
                        selectedItems={this.state.selectedItems}
                        rowRenderers={this.props.rowRenderers}
                        refreshList={this.refreshList}
                        resourceType={this.props.resourceType}
                        createResource={this.props.createResource}
                        updateListType={this.updateListType}
                        currentListType={this.state.listType}
                        commitSearch={this.commitSearch}
                        updateGridColumnCount={this.updateGridColumnCount}
                        gridColumnCount={this.state.gridColumnCount}
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
                    <AutoSizer>
                        {({ height, width }) => {
                            return (
                                <InfiniteLoader
                                    isItemLoaded={this.isItemLoaded}
                                    itemCount={itemCount}
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
                                                layout={
                                                    currentRowRenderer.direction ===
                                                    RowRendererDirection.Horizontal
                                                        ? "horizontal"
                                                        : "vertical"
                                                }
                                                itemData={{
                                                    items: this.state.items,
                                                    handlers: {
                                                        onItemClick: this.onItemClick,
                                                        getSelectedItems: this.getSelectedItems,
                                                        updateRenderModalName:
                                                            this.updateRenderModalName
                                                    },
                                                    selectedItems: this.state.selectedItems,

                                                    //@ts-ignore TODO fix this
                                                    columns: this.state.columns,
                                                    disableContextMenu:
                                                        this.props.disableContextMenu,
                                                    //TODO fix this
                                                    menuItems: this.state
                                                        .menuItems as FilezMenuItems<BaseResource>[],
                                                    resourceType: this.props.resourceType,
                                                    gridColumnCount: this.state.gridColumnCount,
                                                    rowHeight,
                                                    rowHandlers: this.props.rowHandlers
                                                }}
                                                itemCount={itemCount}
                                                width={width}
                                                onItemsRendered={onItemsRendered}
                                                ref={ref}
                                                // without this the context menu cannot be positioned fixed
                                                // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                                style={{ willChange: "none", overflowY: "scroll" }}
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
