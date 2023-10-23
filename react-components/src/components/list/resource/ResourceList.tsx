import { GetResourceParams } from "@firstdorsal/filez-client";
import { SortOrder } from "@firstdorsal/filez-client/dist/js/apiTypes/SortOrder";
import { CSSProperties, PureComponent, ReactElement, createRef } from "react";
import InfiniteLoader from "react-window-infinite-loader";
import update from "immutability-helper";
import SortingBar from "./SortingBar";
import { FixedSizeList } from "react-window";
import { AutoSizer } from "rsuite/esm/Windowing";
import ListTopBar from "./ListTopBar";
import { cloneDeep } from "lodash";

export interface Column<ResourceType> {
    readonly field: string;
    readonly direction: ColumnDirection;
    readonly width: number;
    readonly minWidth: number;
    readonly render?: (item: ResourceType) => JSX.Element;
}

export enum ColumnDirection {
    ASCENDING = 0,
    DESCENDING = 1,
    NEUTRAL = 2
}

export enum ListType {
    Grid,
    List
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
     A function that renders the resource in the list.
     */
    readonly rowRenderer: (
        item: ResourceType,
        style: CSSProperties,
        columns?: Column<ResourceType>[]
    ) => JSX.Element;
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
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly topBar?: JSX.Element;
    readonly id?: string;
    readonly columns?: Column<ResourceType>[];
}

interface ResourceListState<ResourceType> {
    readonly items: ResourceType[];
    readonly total_count: number;
    readonly commitedSearch: string;
    readonly columns?: Column<ResourceType>[];
    readonly listType: ListType;
}

export default class ResourceList<ResourceType> extends PureComponent<
    ResourceListProps<ResourceType>,
    ResourceListState<ResourceType>
> {
    infiniteLoaderRef = createRef<InfiniteLoader>();

    moreItemsLoading = false;

    constructor(props: ResourceListProps<ResourceType>) {
        super(props);
        this.state = {
            items: [],
            total_count: 0,
            commitedSearch: "",
            columns: cloneDeep(props.columns),
            listType: ListType.List
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
                        return {
                            ...column,
                            width: columns[index]
                        };
                    })
                }
            });
        });
    };

    updateColumnDirections = async (columnIndex: number) => {
        this.setState(
            state => {
                if (state.columns === undefined) return state;

                return update(state, {
                    columns: {
                        $set: state.columns.map((column, i) => {
                            if (i === columnIndex) {
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

    updateListType = (listType: ListType) => {
        this.setState({ listType });
    };

    commitSearch = (search: string) => {
        this.setState({ commitedSearch: search }, () => {
            this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
            this.loadItems();
        });
    };

    refreshList = () => {
        this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
        this.loadItems();
    };

    render = () => {
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
        return (
            <div className="Filez ResourceList" style={{ ...this.props.style }}>
                {this.props.displayTopBar !== false && (
                    <ListTopBar
                        refreshList={this.refreshList}
                        resourceType={this.props.resourceType}
                        createResource={this.props.createResource}
                        updateListType={this.updateListType}
                        currentListType={this.state.listType}
                        commitSearch={this.commitSearch}
                    />
                )}
                {this.props.displaySortingBar !== false && this.state.columns && (
                    <SortingBar
                        columns={this.state.columns}
                        updateColumnDirections={this.updateColumnDirections}
                        updateSortingColumnWidths={this.updateSortingColumnWidths}
                    />
                )}
                <div
                    style={{
                        width: "100%",
                        height: `calc(100% - ${barHeights}px)`
                    }}
                >
                    <AutoSizer>
                        {({ height, width }) => (
                            <InfiniteLoader
                                isItemLoaded={index => this.state.items[index] !== undefined}
                                itemCount={fullListLength}
                                loadMoreItems={this.loadMoreItems}
                                ref={this.infiniteLoaderRef}
                            >
                                {({ onItemsRendered, ref }) => (
                                    <FixedSizeList
                                        itemSize={20}
                                        height={height}
                                        itemCount={fullListLength}
                                        width={width}
                                        onItemsRendered={onItemsRendered}
                                        ref={ref}
                                        // without this the context menu cannot be positioned fixed
                                        // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                        style={{ willChange: "none", overflowY: "scroll" }}
                                    >
                                        {({ index, style }) => {
                                            const currentItem = this.state.items[index];
                                            if (!currentItem) {
                                                return <div style={style}></div>;
                                            }
                                            return this.props.rowRenderer(
                                                currentItem,
                                                style,
                                                this.state.columns
                                            );
                                        }}
                                    </FixedSizeList>
                                )}
                            </InfiniteLoader>
                        )}
                    </AutoSizer>
                </div>
            </div>
        );
    };
}
