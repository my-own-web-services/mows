import { CSSProperties, PureComponent, createRef, useContext, useEffect, useState } from "react";
import { FilezContext } from "../../../FilezProvider";
import InfiniteLoader from "react-window-infinite-loader";
import { bytesToHumanReadableSize, utcTimeStampToTimeAndDate } from "../../../utils";
import ResourceList, { Column, ColumnDirection, RowHandlers } from "../resource/ResourceList";
import CreateFile from "./CreateFile";
import EditFile from "./EditFile";
import FileIcon from "../../fileIcons/FileIcon";
import { Tag } from "rsuite";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import GridRowRenderer from "../resource/GridRowRenderer";
import ColumnListRowRenderer from "../resource/ColumnListRowRenderer";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

const defaultColumns: Column<FilezFile>[] = [
    {
        field: "name",
        label: "Name",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 30,
        minWidthPixels: 50,
        visible: true,
        render: (item: FilezFile) => {
            return (
                <span style={{ height: "100%" }}>
                    <FileIcon
                        style={{
                            height: "100%",
                            float: "left",
                            paddingRight: "4px"
                        }}
                        file={item}
                    />
                    {item.name}
                </span>
            );
        }
    },
    {
        field: "size",
        label: "Size",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 10,
        minWidthPixels: 50,
        visible: true,
        render: (item: FilezFile) => {
            return <span>{bytesToHumanReadableSize(item.size)}</span>;
        }
    },
    {
        field: "mime_type",
        label: "Mime Type",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 20,
        minWidthPixels: 50,
        visible: true,
        render: (item: FilezFile) => {
            return <span>{item.mime_type}</span>;
        }
    },
    {
        field: "modified",
        label: "Modified",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 20,
        minWidthPixels: 50,
        visible: true,
        render: (item: FilezFile) => {
            return <span>{utcTimeStampToTimeAndDate(item.modified)}</span>;
        }
    },
    {
        field: "static_file_group_ids",
        label: "Static Groups",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 20,
        minWidthPixels: 50,
        visible: true,
        render: (item: FilezFile) => <GroupTags file={item} />
    }
];

const GroupTags = ({ file }: { file: FilezFile }) => {
    const [groups, setGroups] = useState<FilezFileGroup[]>([]);
    const context = useContext(FilezContext);

    useEffect(() => {
        context?.filezClient.get_file_groups(file.static_file_group_ids).then(setGroups);
    }, [file, context]);

    return (
        <span>
            {file.static_file_group_ids.map(id => {
                const group = groups.find(g => g._id === id);
                return (
                    <Tag size="xs" key={id}>
                        {group?.name ?? group?._id}
                    </Tag>
                );
            })}
        </span>
    );
};

interface FileListProps {
    readonly id: string;
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly initialListType?: string;
    readonly rowHandlers?: RowHandlers;
}

interface FileListState {}

export default class FileList extends PureComponent<FileListProps, FileListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    moreItemsLoading = false;

    infiniteLoaderRef = createRef<InfiniteLoader>();

    constructor(props: FileListProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        if (!this.context) return;
        return (
            <div className="Filez FileList" style={{ ...this.props.style }}>
                <ResourceList
                    createResource={<CreateFile />}
                    editResource={<EditFile />}
                    resourceType="File"
                    defaultSortField="name"
                    initialListType={"ColumnListRowRenderer"}
                    get_items_function={this.context.filezClient.get_file_infos_by_group_id}
                    id={this.props.id}
                    //@ts-ignore TODO fix this generic mess
                    rowRenderers={[GridRowRenderer, ColumnListRowRenderer]}
                    displaySortingBar={this.props.displaySortingBar}
                    displayTopBar={this.props.displayTopBar}
                    rowHandlers={this.props.rowHandlers}
                    columns={defaultColumns}
                />
            </div>
        );
    };
}
