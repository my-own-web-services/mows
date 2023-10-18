import { CSSProperties, PureComponent, createRef } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import { FilezContext } from "../../../FilezProvider";
import InfiniteLoader from "react-window-infinite-loader";
import FileListTopBar from "./FileListTopBar";
import { ContextMenu, ContextMenuTrigger, MenuItem } from "react-contextmenu";
import SortingBar from "./SortingBar";
import update from "immutability-helper";
import { bytesToHumanReadableSize } from "../../../utils";
import { SortOrder } from "@firstdorsal/filez-client/dist/js/apiTypes/SortOrder";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

export interface Column {
    readonly field: string;
    readonly direction: ColumnDirection;
    readonly width: number;
    readonly minWidth: number;
    readonly render?: (item: FilezFile) => JSX.Element;
}

export enum ColumnDirection {
    ASCENDING = 0,
    DESCENDING = 1,
    NEUTRAL = 2
}

const defaultColumns: Column[] = [
    {
        field: "name",
        direction: ColumnDirection.ASCENDING,
        width: 50,
        minWidth: 50
    },
    {
        field: "size",
        direction: ColumnDirection.NEUTRAL,
        width: 50,
        minWidth: 50,
        render: (item: FilezFile) => {
            return <span>{bytesToHumanReadableSize(item.size)}</span>;
        }
    }
];

interface FileListProps {
    readonly id: string;
    readonly style?: CSSProperties;
    readonly rowRenderer?: (
        item: FilezFile,
        style: CSSProperties,
        columns: Column[]
    ) => JSX.Element;
    /**
     * Default Row Renderer onClick handler
     */
    readonly drrOnClick?: (item: FilezFile) => void;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly initialListType?: ListType;
}

export enum ListType {
    Grid,
    List
}

interface FileListState {
    readonly fileList: FilezFile[];
    readonly listLength: number;
    readonly initialLoadFinished: boolean;
    readonly columns: Column[];
    readonly listType: ListType;
    readonly commitedSearch: string;
}

export default class FileList extends PureComponent<FileListProps, FileListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    moreItemsLoading = false;

    infiniteLoaderRef = createRef<InfiniteLoader>();

    constructor(props: FileListProps) {
        super(props);
        this.state = {
            fileList: [],
            initialLoadFinished: false,
            listLength: 0,
            columns: [...defaultColumns],
            listType: props.initialListType ?? ListType.List,
            commitedSearch: ""
        };
    }

    componentDidMount = async () => {
        await this.loadData();
    };

    componentDidUpdate = async (
        prevProps: Readonly<FileListProps>,
        prevState: Readonly<FileListState>
    ) => {
        if (this.context === null) {
            throw new Error("FileList must be used inside Filez to provide the FilezContext");
        }
        const filezClient = this.context.filezClient;
        // TODO handle updates when (group)id changes
        if (prevState.initialLoadFinished === true && filezClient !== null) {
            if (prevProps.id !== this.props.id) {
                await this.loadData();
            }
        }
    };

    loadData = async () => {
        //console.log("loadData");

        if (this.context === null) {
            throw new Error("FileList must be used inside Filez to provide the FilezContext");
        }
        const filezClient = this.context.filezClient;
        this.moreItemsLoading = true;

        const { files, total_count } = await filezClient.get_file_infos_by_group_id(
            this.props.id,
            0,
            30,
            ...this.get_current_column_sorting(this.state.columns),
            this.state.commitedSearch
        );
        this.moreItemsLoading = false;

        this.setState({
            fileList: files,
            initialLoadFinished: true,
            listLength: total_count
        });
    };

    loadMoreItems = async (startIndex: number, limit: number) => {
        if (!this.context) return;
        if (this.moreItemsLoading) return;

        const filezClient = this.context.filezClient;

        const { files } = await filezClient.get_file_infos_by_group_id(
            this.props.id,
            startIndex,
            limit,
            ...this.get_current_column_sorting(this.state.columns),
            this.state.commitedSearch
        );

        this.setState(({ fileList }) => {
            for (let i = 0; i < files.length; i++) {
                fileList[startIndex + i] = files[i];
            }
            return { fileList };
        });
    };

    get_current_column_sorting = (columns: Column[]): [string, SortOrder] => {
        for (const column of columns) {
            if (column.direction !== ColumnDirection.NEUTRAL) {
                return [
                    column.field,
                    column.direction === ColumnDirection.ASCENDING ? "Ascending" : "Descending"
                ];
            }
        }
        return ["name", "Ascending"];
    };

    updateColumnWidths = (columns: number[]) => {
        this.setState(state => {
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
                this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
                this.loadData();
            }
        );
    };

    defaultRowRenderer = (item: FilezFile, style: CSSProperties, columns: Column[]) => {
        return (
            <div
                className="DefaultRowRenderer"
                onClick={() => this.props.drrOnClick && this.props.drrOnClick(item)}
            >
                {/*@ts-ignore*/}
                <ContextMenuTrigger disableIfShiftIsPressed={true} id={item._id}>
                    <div className="clickable" style={style}>
                        {columns.map((column, index) => {
                            /*@ts-ignore*/
                            const field = item[column.field];
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
                                        : field ?? `Field '${column.field}' does not exist on File`}
                                </span>
                            );
                        })}
                    </div>
                </ContextMenuTrigger>
                {/*@ts-ignore*/}
                <ContextMenu id={item._id}>
                    {/*@ts-ignore*/}
                    <MenuItem
                        className="clickable"
                        data={{ _id: item._id }}
                        onClick={() => {
                            console.log(item);
                        }}
                    >
                        <span>Log File</span>
                    </MenuItem>
                </ContextMenu>
            </div>
        );
    };

    updateListType = (listType: ListType) => {
        this.setState({ listType });
    };
    commitSearch = (search: string) => {
        this.setState({ commitedSearch: search }, () => {
            this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
            this.loadData();
        });
    };

    render = () => {
        const fullListLength = this.state.listLength;

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
            <div className="Filez FileList" style={{ ...this.props.style }}>
                {this.props.displayTopBar !== false && (
                    <FileListTopBar
                        updateListType={this.updateListType}
                        currentListType={this.state.listType}
                        commitSearch={this.commitSearch}
                    />
                )}
                {this.props.displaySortingBar !== false && (
                    <SortingBar
                        columns={this.state.columns}
                        updateColumnDirections={this.updateColumnDirections}
                        updateSortingColumnWidths={this.updateColumnWidths}
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
                                isItemLoaded={index => this.state.fileList[index] !== undefined}
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
                                            const currentItem = this.state.fileList[index];
                                            if (!currentItem) {
                                                return <div style={style}></div>;
                                            }
                                            if (this.props.rowRenderer) {
                                                return this.props.rowRenderer(
                                                    currentItem,
                                                    style,
                                                    this.state.columns
                                                );
                                            }
                                            return this.defaultRowRenderer(
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
