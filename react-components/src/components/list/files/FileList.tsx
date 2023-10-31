import { CSSProperties, PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import InfiniteLoader from "react-window-infinite-loader";
import { bytesToHumanReadableSize } from "../../../utils";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import ResourceList, { Column, ColumnDirection, ListType } from "../resource/ResourceList";

const defaultColumns: Column<FilezFile>[] = [
    {
        field: "name",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 50,
        minWidthPixels: 50
    },
    {
        field: "size",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 50,
        minWidthPixels: 50,
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

    rowRenderer = (item: FilezFile, columns?: Column<FilezFile>[]) => {
        return (
            <div onClick={() => this.props.drrOnItemClick && this.props.drrOnItemClick(item)}>
                {columns?.map((column, index) => {
                    /*@ts-ignore*/
                    const field = item[column.field];
                    return (
                        <span
                            key={column.field + index}
                            style={{
                                width: column.widthPercent + "%",
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
        );
    };

    render = () => {
        if (!this.context) return;
        return (
            <div className="Filez FileList" style={{ ...this.props.style }}>
                <ResourceList
                    resourceType="File"
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
