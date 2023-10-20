import { CSSProperties, PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import InfiniteLoader from "react-window-infinite-loader";
import { ContextMenu, ContextMenuTrigger, MenuItem } from "react-contextmenu";
import { bytesToHumanReadableSize } from "../../../utils";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import ResourceList, { Column, ColumnDirection, ListType } from "../ResourceList";

const defaultColumns: Column<FilezFile>[] = [
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
        columns: Column<FilezFile>[]
    ) => JSX.Element;
    /**
     * Default Row Renderer item onClick handler
     */
    readonly drrOnItemClick?: (item: FilezFile) => void;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly initialListType?: ListType;
}

interface FileListState {
    readonly columns: Column<FilezFile>[];
}

export default class FileList extends PureComponent<FileListProps, FileListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    moreItemsLoading = false;

    infiniteLoaderRef = createRef<InfiniteLoader>();

    constructor(props: FileListProps) {
        super(props);
        this.state = {
            columns: [...defaultColumns]
        };
    }

    rowRenderer = (item: FilezFile, style: CSSProperties, columns?: Column<FilezFile>[]) => {
        return (
            <div
                className="DefaultRowRenderer"
                onClick={() => this.props.drrOnItemClick && this.props.drrOnItemClick(item)}
            >
                {/*@ts-ignore*/}
                <ContextMenuTrigger disableIfShiftIsPressed={true} id={item._id}>
                    <div className="clickable" style={style}>
                        {columns?.map((column, index) => {
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

    render = () => {
        if (!this.context) return;
        return (
            <div className="Filez FileList" style={{ ...this.props.style }}>
                <ResourceList
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.get_file_infos_by_group_id}
                    id={this.props.id}
                    rowRenderer={this.rowRenderer}
                    displaySortingBar={this.props.displaySortingBar}
                    displayTopBar={this.props.displayTopBar}
                    columns={this.state.columns}
                />
            </div>
        );
    };
}
