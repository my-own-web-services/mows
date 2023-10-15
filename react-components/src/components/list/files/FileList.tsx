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
    readonly search: string;
}

export default class FileList extends PureComponent<FileListProps, FileListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    moreFilesLoading = false;

    infiniteLoaderRef = createRef<InfiniteLoader>();

    constructor(props: FileListProps) {
        super(props);
        this.state = {
            fileList: [],
            initialLoadFinished: false,
            listLength: 0,
            columns: [...defaultColumns],
            listType: props.initialListType ?? ListType.List,
            search: ""
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
        } else {
            const filezClient = this.context.filezClient;
            // TODO handle updates when (group)id changes
            if (prevState.initialLoadFinished === true && filezClient !== null) {
                if (prevProps.id !== this.props.id) {
                    await this.loadData();
                }
            }
        }
    };

    loadData = async () => {
        console.log("loadData");

        if (this.context === null) {
            throw new Error("FileList must be used inside Filez to provide the FilezContext");
        } else {
            const filezClient = this.context.filezClient;
            this.moreFilesLoading = true;

            const [groups, files] = await Promise.all([
                filezClient.get_own_file_groups(),
                filezClient.get_file_infos_by_group_id(
                    this.props.id,
                    0,
                    30,
                    ...this.get_current_column_sorting(this.state.columns)
                )
            ]);
            this.moreFilesLoading = false;
            const currentGroup = groups.find(group => group._id === this.props.id);
            if (currentGroup === undefined) {
                throw new Error("Current group does not exist");
            }

            this.setState({
                fileList: files,
                initialLoadFinished: true,
                listLength: currentGroup.itemCount
            });
        }
    };

    loadMoreFiles = async (startIndex: number, limit: number) => {
        console.log("loadMoreFiles", startIndex, limit);

        if (this.context === null) {
            throw new Error("FileList must be used inside Filez to provide the FilezContext");
        } else {
            const filezClient = this.context.filezClient;

            if (this.moreFilesLoading === false) {
                const newFiles = await filezClient.get_file_infos_by_group_id(
                    this.props.id,
                    startIndex,
                    limit,
                    ...this.get_current_column_sorting(this.state.columns)
                );

                this.setState(({ fileList }) => {
                    for (let i = 0; i < newFiles.length; i++) {
                        fileList[startIndex + i] = newFiles[i];
                    }
                    return { fileList };
                });
            }
        }
    };

    get_current_column_sorting = (columns: Column[]): [string, SortOrder] => {
        for (const column of columns) {
            if (column.direction !== ColumnDirection.NEUTRAL) {
                return [
                    column.field,
                    column.direction === ColumnDirection.ASCENDING ? "ascending" : "descending"
                ];
            }
        }
        return ["name", "ascending"];
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
    updateSearch = (search: string) => {
        this.setState({ search });
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
                        updateSearch={this.updateSearch}
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
                                loadMoreItems={this.loadMoreFiles}
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
                                        style={{ willChange: "none" }}
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
