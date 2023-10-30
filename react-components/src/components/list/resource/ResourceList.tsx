import { FilezClient, GetResourceParams } from "@firstdorsal/filez-client";
import { SortOrder } from "@firstdorsal/filez-client/dist/js/apiTypes/SortOrder";
import { CSSProperties, PureComponent, ReactElement, createRef } from "react";
import InfiniteLoader from "react-window-infinite-loader";
import update from "immutability-helper";
import SortingBar from "./SortingBar";
import { FixedSizeList } from "react-window";
import { AutoSizer } from "rsuite/esm/Windowing";
import ListTopBar from "./ListTopBar";
import { cloneDeep } from "lodash";
import { ContextMenu, ContextMenuTrigger, MenuItem } from "react-contextmenu";
import { Button, Modal } from "rsuite";
import { FilezContext } from "../../../FilezProvider";
import { match } from "ts-pattern";

export interface FilezMenuItems<ResourceType> {
    name: string;
    onClickOneItem?: (item: ResourceType) => void;
    onClickMultipleItems?: (items: ResourceType[]) => void;
    render?: (
        items: BaseResource[],
        resourceType: string,
        close: () => void,
        filezClient: FilezClient
    ) => JSX.Element;
}

const defaultMenuItems: FilezMenuItems<BaseResource>[] = [
    {
        name: "Log to console",
        onClickOneItem: (item: BaseResource) => {
            console.log(item);
        },
        onClickMultipleItems: (items: BaseResource[]) => {
            console.log(items);
        }
    },
    {
        name: "Delete",

        render: (
            items: BaseResource[],
            resourceType: string,
            handleClose: () => void,
            filezClient: FilezClient
        ) => {
            if (items.length === 0) return <></>;
            const multiple = items.length > 1;
            const single = items.length === 1;

            // @ts-ignore
            const name = items?.[0].name ?? items[0]._id;

            return (
                <Modal open={true} onClose={handleClose}>
                    <Modal.Header>
                        <Modal.Title>
                            Delete {multiple && ` ${items.length} `}
                            {resourceType}
                            {single && ` ${name}`}
                            {multiple && "s"}? This cannot be undone.
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Button
                            color="red"
                            style={{ marginRight: "10px" }}
                            appearance="primary"
                            onClick={() => {
                                const promises = items.map(item => {
                                    return match(resourceType)
                                        .with("Permission", () => {
                                            return filezClient.delete_permission(item._id);
                                        })
                                        .with("File", () => {
                                            return filezClient.delete_file(item._id);
                                        })
                                        .with("FileGroup", () => {
                                            return filezClient.delete_file_group(item._id);
                                        })
                                        .with("UserGroup", () => {
                                            return filezClient.delete_user_group(item._id);
                                        });
                                });
                                Promise.all(promises).then(() => {
                                    handleClose();
                                });
                            }}
                        >
                            Delete
                        </Button>

                        <Button onClick={handleClose}>Cancel</Button>
                    </Modal.Body>
                </Modal>
            );
        }
    },
    {
        name: "Edit",
        onClickOneItem: (item: BaseResource) => {
            console.log(item);
        },
        onClickMultipleItems: (items: BaseResource[]) => {
            console.log(items);
        }
    }
];

export interface Column<ResourceType> {
    readonly field: string;
    readonly alternateField?: string;
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

export interface BaseResource {
    _id: string;
}

interface ResourceListProps<ResourceType extends BaseResource> {
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
    readonly rowRenderer?: (item: ResourceType) => JSX.Element;
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
    readonly disableContextMenu?: boolean;
}

interface ResourceListState<ResourceType> {
    readonly items: ResourceType[];
    readonly total_count: number;
    readonly commitedSearch: string;
    readonly columns?: Column<ResourceType>[];
    readonly listType: ListType;
    readonly menuItems: FilezMenuItems<ResourceType>[];
    readonly selectedItems: SelectedItems;
    readonly renderModalName: string;
}

interface SelectedItems {
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
            listType: ListType.List,
            menuItems: defaultMenuItems,
            selectedItems: {},
            renderModalName: ""
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

    onRowClick = (
        e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
        item: ResourceType,
        callAfterClick?: () => void
    ) => {
        // @ts-ignore
        //if (e.target?.classList?.contains("clickable")) return;

        if (e.ctrlKey) {
            this.setState(
                state => {
                    return {
                        selectedItems: {
                            ...state.selectedItems,
                            [item._id]: state.selectedItems[item._id] ? false : true
                        }
                    };
                },
                () => callAfterClick?.()
            );
        } else if (e.shiftKey) {
            this.setState(
                state => {
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
                },
                () => callAfterClick?.()
            );
        } else {
            this.setState(
                state => {
                    return {
                        selectedItems: {
                            [item._id]: state.selectedItems[item._id] ? false : true
                        }
                    };
                },
                () => callAfterClick?.()
            );
        }
    };

    rowRenderer = (item: ResourceType, style: CSSProperties, columns?: Column<ResourceType>[]) => {
        console.log("rendering row");

        const inner = () => (
            <>
                {columns ? (
                    columns.map((column, index) => {
                        /*@ts-ignore*/
                        const field = item[column.field]
                            ? /*@ts-ignore*/
                              item[column.field]
                            : /*@ts-ignore*/
                              item[column.alternateField];
                        return (
                            <span
                                key={column.field + index}
                                style={{
                                    width: column.width + "%",
                                    display: "block",
                                    float: "left",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }}
                            >
                                {column.render
                                    ? column.render(item)
                                    : field ??
                                      `Field '${column.field}' does not exist on this ${this.props.resourceType}`}
                            </span>
                        );
                    })
                ) : this.props.rowRenderer ? (
                    this.props.rowRenderer(item)
                ) : (
                    <span>{item._id}</span>
                )}
            </>
        );

        return (
            <div
                onClick={e => this.onRowClick(e, item)}
                style={{
                    ...style
                }}
                className={`Row${this.state.selectedItems[item._id] ? " selected" : ""}`}
            >
                {this.props.disableContextMenu ? (
                    inner()
                ) : (
                    <>
                        {/*@ts-ignore*/}
                        <ContextMenuTrigger
                            style={style}
                            disableIfShiftIsPressed={true}
                            id={item._id}
                        >
                            {inner()}
                        </ContextMenuTrigger>
                        {/*@ts-ignore*/}
                        <ContextMenu id={item._id}>
                            {this.state.menuItems.map(menuItem => {
                                return (
                                    // @ts-ignore
                                    <MenuItem
                                        key={menuItem.name}
                                        className="clickable"
                                        onClick={e => {
                                            // select the current item
                                            // TODO this does not work if no item is selected yet
                                            let selected = Object.keys(this.state.selectedItems)
                                                .filter(id => this.state.selectedItems[id] === true)
                                                .flatMap(id => {
                                                    const item = this.state.items.find(
                                                        item => item._id === id
                                                    );
                                                    return item ? [item] : [];
                                                });

                                            if (selected.length > 1) {
                                                if (menuItem.onClickMultipleItems) {
                                                    menuItem.onClickMultipleItems(selected);
                                                }
                                            } else {
                                                if (menuItem.onClickOneItem) {
                                                    menuItem.onClickOneItem(item);
                                                }
                                            }
                                            this.setState({
                                                renderModalName: menuItem.name
                                            });
                                        }}
                                    >
                                        {menuItem.name}
                                    </MenuItem>
                                );
                            })}
                        </ContextMenu>
                    </>
                )}
            </div>
        );
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
        return (
            <div className="Filez ResourceList" style={{ ...this.props.style }}>
                {(() => {
                    const mi = this.state.menuItems.filter(
                        menuItem => menuItem.name === this.state.renderModalName
                    )[0];

                    return (
                        mi &&
                        mi.render &&
                        mi.render(
                            this.state.items.filter(
                                item => this.state.selectedItems[item._id] === true
                            ),
                            this.props.resourceType,
                            () => {
                                this.setState({ renderModalName: "" });
                            },
                            this.context.filezClient
                        )
                    );
                })()}
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

                                            return this.rowRenderer(
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
