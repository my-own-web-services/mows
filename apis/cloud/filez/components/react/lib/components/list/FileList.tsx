import { CSSProperties, PureComponent, createRef } from "react";

import { FileGroupType, FilezFile, ListFilesSortBy, SortDirection } from "filez-client-typescript";

import { ActionIds } from "@/lib/defaultActions";
import { ActionHandler } from "@/lib/filezContext/ActionManager";
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
import GridListRowHandler from "./ResourceList/rowHandlers/Grid";

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

    listId: string;

    actionHandler: ActionHandler;

    constructor(props: FileListProps) {
        super(props);
        this.state = {
            createModalOpen: false,
            deleteModalOpen: false,
            editModalOpen: false,
            selectedFiles: []
        };

        this.listId = Math.random().toString(36).substring(2, 15);

        this.actionHandler = {
            executeAction: () => {
                const selectedItems = this.resourceListRef.current?.getSelectedItems() || [];
                if (selectedItems.length === 0) {
                    log.debug("No files selected, cannot delete");
                    return;
                }
                log.debug("Delete files action triggered for files:", selectedItems);
            },
            id: this.listId,
            getState: () => {
                const selectedItems = this.resourceListRef.current?.getSelectedItems() || [];
                if (selectedItems.length === 0) {
                    return { visibility: "inactive", disabledReason: "No files selected" };
                }
                return { visibility: "active" };
            }
        };
    }

    componentDidMount = async () => {
        log.debug("CommandPalette mounted:", this.props);
        this.registerActionHandler();
    };

    componentDidUpdate = (prevProps: FileListProps) => {
        log.debug("CommandPalette props updated:", this.props);

        this.registerActionHandler();
    };

    registerActionHandler = () => {
        if (this.context?.actionManager?.registerActionHandler) {
            this.context?.actionManager?.registerActionHandler(
                ActionIds.DELETE_FILES,
                this.actionHandler
            );
        }
    };

    componentWillUnmount = () => {
        this.context?.actionManager?.unregisterActionHandler(
            ActionIds.DELETE_FILES,
            this.actionHandler.id
        );
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
            <div
                data-actionscope={this.listId}
                className={cn("FileList", this.props.className)}
                style={{ ...this.props.style }}
            >
                <ResourceList<FilezFile>
                    ref={this.resourceListRef}
                    resourceType="File"
                    defaultSortBy={"Name"}
                    defaultSortDirection={SortDirection.Ascending}
                    initialRowHandler={"GridListRowHandler"}
                    getResourcesList={this.getFilesList}
                    dropTargetAcceptsTypes={["File"]}
                    id={this.props.id}
                    rowHandlers={[
                        new ColumnListRowHandler({
                            columns: defaultColumns
                        }),
                        new GridListRowHandler({})
                    ]}
                    displayListHeader={this.props.displayTopBar}
                    displayDebugBar={true}
                    handlers={{
                        ...this.props.resourceListHandlers
                    }}
                />
            </div>
        );
    };
}

/*
Delete File -> 
    - Should only be active when one or more files are selected -> No feedback no display when nothing is selected
    - should only be active when the user has delete permissions -> feedback: disabled action in commandPalette and context menu, toast when hotkey is pressed

If two File lists are open and files are selected in both, the delete action should only delete files from the last focused list

Copy File
Duplicate File
Open File
Open file with

New File
*/

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
