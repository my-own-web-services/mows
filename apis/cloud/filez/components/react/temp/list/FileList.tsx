import { CSSProperties, PureComponent, createRef } from "react";
import {
    Column,
    ListResourceRequestBody,
    ListResourceResponseBody,
    ResourceListHandlers,
    ResourceListRowHandlers
} from "./resource/ResourceListTypes";

import FileIcon from "../fileIcons/FileIcon";

import { FileGroupType, FilezFile, ListFilesSortBy, SortDirection } from "filez-client-typescript";
import { FilezContext } from "../../FilezContext";
import ResourceList from "./resource/ResourceList";
import ColumnListRowRenderer from "./resource/rowRenderers/Column";
import GridRowRenderer from "./resource/rowRenderers/Grid";

const defaultColumns: Column<FilezFile>[] = [
    {
        field: "name",
        label: "Name",
        direction: SortDirection.Ascending,
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
        field: "mime_type",
        label: "Mime Type",
        direction: SortDirection.Neutral,
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
        direction: SortDirection.Neutral,
        widthPercent: 20,
        minWidthPixels: 50,
        visible: true,
        render: (item: FilezFile) => {
            return <span>{item.modified_time}</span>;
        }
    }
];
/*
    {
        field: "static_file_group_ids",
        label: "Static Groups",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 20,
        minWidthPixels: 50,
        visible: true,
        render: (item: FilezFile) => <GroupTags file={item} />
    }

*/

interface FileListProps {
    readonly id?: string;
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly initialListType?: string;
    readonly resourceListRowHandlers?: ResourceListRowHandlers<FilezFile>;
    readonly resourceListHandlers?: ResourceListHandlers<FilezFile>;
    readonly handlers?: FileListHandlers;
    readonly listSubType?: FileGroupType;
}

export interface FileListHandlers {
    onChange?: () => void;
}

interface FileListState {
    readonly createModalOpen: boolean;
    readonly deleteModalOpen: boolean;
    readonly editModalOpen: boolean;
    readonly selectedFiles: FilezFile[];
}

export default class FileList extends PureComponent<FileListProps, FileListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    resourceListRef = createRef<ResourceList<FilezFile>>();

    constructor(props: FileListProps) {
        super(props);
        this.state = {
            createModalOpen: false,
            deleteModalOpen: false,
            editModalOpen: false,
            selectedFiles: []
        };
    }

    onCreateClick = async () => {
        this.setState({ createModalOpen: true });
    };

    closeCreateModal = () => {
        this.setState({ createModalOpen: false });
    };

    closeDeleteModal = () => {
        this.setState({ deleteModalOpen: false });
    };

    onContextMenuItemClick = (
        item: FilezFile,
        menuItemId?: string,
        selectedItems?: FilezFile[]
    ) => {
        if (menuItemId === "log") {
            if (selectedItems?.length === 1) {
                log.info(item);
            } else {
                log.info(selectedItems);
            }
        } else if (menuItemId === "delete") {
            this.setState({
                deleteModalOpen: true,
                selectedFiles: selectedItems ?? []
            });
        } else if (menuItemId === "edit") {
            this.setState({
                editModalOpen: true,
                selectedFiles: selectedItems ?? []
            });
        }
    };

    deleteClick = async () => {
        if (!this.context) return;

        // TODO

        this.closeDeleteModal();
        this.resourceListRef.current?.refreshList();
        this.props.handlers?.onChange?.();
    };

    closeEditModal = () => {
        this.setState({ editModalOpen: false });
    };

    onEditChange = () => {
        this.resourceListRef.current?.refreshList();
        this.props.handlers?.onChange?.();
    };

    getFilesList = async (
        request: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<FilezFile>> => {
        if (!this.context) return { totalCount: 0, items: [] };
        if (!this.props.id) return { totalCount: 0, items: [] };
        const res = await this.context.filezClient.api.listFilesInFileGroup({
            file_group_id: this.props.id,
            from_index: request.fromIndex,
            limit: request.limit,
            sort: {
                SortOrder: {
                    sort_by: request.sortBy as ListFilesSortBy,
                    sort_order: request.sortDirection
                }
            }
        });
        if (res.status === 200 && res.data.data) {
            return { totalCount: res.data.data.total_count, items: res.data.data.files };
        }
        return { totalCount: 0, items: [] };
    };

    render = () => {
        if (!this.context) return;
        return (
            <div className="Filez FileList" style={{ ...this.props.style }}>
                <ResourceList
                    ref={this.resourceListRef}
                    resourceType="File"
                    defaultSortField="name"
                    initialListType={"ColumnListRowRenderer"}
                    getResourcesList={this.getFilesList}
                    dropTargetAcceptsTypes={["File"]}
                    id={this.props.id}
                    rowRenderers={[
                        GridRowRenderer<FilezFile>(),
                        ColumnListRowRenderer<FilezFile>()
                    ]}
                    displaySortingBar={this.props.displaySortingBar}
                    displayTopBar={this.props.displayTopBar}
                    rowHandlers={{
                        onContextMenuItemClick: this.onContextMenuItemClick,
                        ...this.props.resourceListRowHandlers
                    }}
                    columns={defaultColumns}
                    handlers={{
                        onCreateClick: this.onCreateClick,
                        ...this.props.resourceListHandlers
                    }}
                />
            </div>
        );
    };
}
