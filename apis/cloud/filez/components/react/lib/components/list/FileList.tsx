import { CSSProperties, PureComponent, createRef } from "react";

import { FileGroupType, FilezFile, ListFilesSortBy, SortDirection } from "filez-client-typescript";

import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import ResourceList from "./ResourceList/ResourceList";
import {
    ListResourceRequestBody,
    ListResourceResponseBody,
    ResourceListHandlers,
    ResourceListRowHandlers
} from "./ResourceList/ResourceListTypes";
import ColumnListRowHandler, { Column } from "./ResourceList/rowHandlers/Column";

interface FileListProps {
    readonly id?: string;
    readonly className?: string;
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
        if (!this.context?.filezClient) {
            log.warn("No filezClient available");
            return { totalCount: 0, items: [] };
        }
        if (!this.props.id) {
            log.warn("No file group ID provided");
            return { totalCount: 0, items: [] };
        }
        if (!this.context?.clientAuthenticated) {
            log.warn("Client not authenticated");
            return { totalCount: 0, items: [] };
        }

        const apiRequest = {
            file_group_id: this.props.id,
            from_index: request.fromIndex,
            limit: request.limit,
            sort: {
                SortOrder: {
                    sort_by: request.sortBy as ListFilesSortBy,
                    sort_order: request.sortDirection
                }
            }
        };

        const res = await this.context.filezClient.api.listFilesInFileGroup(apiRequest);

        if (res.status === 200 && res.data.data) {
            const result = { totalCount: res.data.data.total_count, items: res.data.data.files };
            return result;
        }

        log.warn("API response not successful or no data");
        return { totalCount: 0, items: [] };
    };

    render = () => {
        if (!this.context?.clientAuthenticated) {
            return <></>;
        }

        return (
            <div className={cn("FileList", this.props.className)} style={{ ...this.props.style }}>
                <ResourceList<FilezFile>
                    ref={this.resourceListRef}
                    resourceType="File"
                    defaultSortBy={"Name"}
                    defaultSortDirection={SortDirection.Ascending}
                    initialRowHandler={"ColumnListRowHandler"}
                    getResourcesList={this.getFilesList}
                    dropTargetAcceptsTypes={["File"]}
                    id={this.props.id}
                    rowHandlers={[new ColumnListRowHandler({ columns: defaultColumns })]}
                    displaySortingBar={this.props.displaySortingBar}
                    displayListHeader={this.props.displayTopBar}
                    handlers={{
                        onCreateClick: this.onCreateClick,
                        ...this.props.resourceListHandlers
                    }}
                />
            </div>
        );
    };
}

const defaultColumns: Column<FilezFile>[] = [
    {
        field: "Name",
        label: "Name",
        direction: SortDirection.Ascending,
        widthPercent: 40,
        minWidthPixels: 50,
        enabled: true,
        render: (item: FilezFile, style: CSSProperties, className: string) => {
            return (
                <span style={{ ...style }} className={className}>
                    {item.name}
                </span>
            );
        }
    },
    {
        field: "MimeType",
        label: "Mime Type",
        direction: SortDirection.Neutral,
        widthPercent: 30,
        minWidthPixels: 50,
        enabled: true,
        render: (item: FilezFile, style: CSSProperties, className: string) => {
            return (
                <span style={{ ...style }} className={className}>
                    {item.mime_type}
                </span>
            );
        }
    },
    {
        field: "ModifiedTime",
        label: "Modified",
        direction: SortDirection.Neutral,
        widthPercent: 30,
        minWidthPixels: 50,
        enabled: true,
        render: (item: FilezFile, style: CSSProperties, className: string) => {
            return (
                <span style={{ ...style }} className={className}>
                    {item.modified_time}
                </span>
            );
        }
    }
];
