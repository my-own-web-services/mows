import { CSSProperties, PureComponent, createRef } from "react";

import { FileGroupType, FilezFile, ListFilesSortBy } from "filez-client-typescript";

import { MowsContext } from "mows-components-react/lib/mowsContext/MowsContext";
import { type FilezContextType, withFilez } from "@/lib/filezContext/FilezContext";
import { FilezActionIds as ActionIds } from "@/lib/filezActions";
import { ActionHandler, ActionVisibility } from "mows-components-react/lib/mowsContext/ActionManager";
import { log } from "mows-components-react/lib/logging";
import { cn } from "@/lib/utils";
import ResourceList from "mows-components-react/components/list/ResourceList/ResourceList";
import {
    ListResourceRequestBody,
    ListResourceResponseBody,
    ResourceListHandlers,
    ResourceListRowHandlers,
    SortDirection
} from "mows-components-react/components/list/ResourceList/ResourceListTypes";
import ColumnListRowHandler, { Column } from "mows-components-react/components/list/ResourceList/rowHandlers/Column";
import GridListRowHandler from "mows-components-react/components/list/ResourceList/rowHandlers/Grid";
import FileViewer from "@/components/fileViewer/FileViewer";

interface FileListProps {
    readonly fileGroupId: string;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly initialListType?: string;
    readonly resourceListRowHandlers?: ResourceListRowHandlers<FilezFile>;
    readonly resourceListHandlers?: ResourceListHandlers<FilezFile>;
    readonly handlers?: FileListHandlers;
    readonly listSubType?: FileGroupType;
    readonly filez: FilezContextType;
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

class FileListBase extends PureComponent<FileListProps, FileListState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    resourceListRef = createRef<ResourceList<FilezFile>>();

    listId: string;
    listActionScopeId: string;

    actionHandler: ActionHandler;

    defaultColumns: Column<FilezFile>[] = [
        {
            field: `Name`,
            label: `Name`,
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
            field: `MimeType`,
            label: `Mime Type`,
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
            field: `ModifiedTime`,
            label: `Modified`,
            direction: SortDirection.Neutral,
            widthPercent: 30,
            minWidthPixels: 50,
            enabled: true,
            render: (item: FilezFile, style: CSSProperties, className: string) => {
                return (
                    <span data-actionscope={`test`} style={{ ...style }} className={className}>
                        {item.modified_time}
                    </span>
                );
            }
        }
    ];

    constructor(props: FileListProps) {
        super(props);
        this.state = {
            createModalOpen: false,
            deleteModalOpen: false,
            editModalOpen: false,
            selectedFiles: []
        };

        this.listId = Math.random().toString(36).substring(2, 15);
        this.listActionScopeId = `FileList-${this.listId}`;

        this.actionHandler = {
            executeAction: async () => {
                const selectedItems = this.resourceListRef.current?.getSelectedItems() || [];
                if (selectedItems.length === 0) {
                    log.debug(`No files selected, cannot delete`);
                    return;
                }
                log.debug(`Delete files action triggered for files:`, selectedItems);
                for (const file of selectedItems) {
                    log.info(`Deleting file: ${file.name} (${file.id})`);
                    await this.props.filez.filezClient.api.deleteFile(file.id);
                    this.resourceListRef.current?.refreshList();
                }
            },
            id: this.listId,
            scopes: [this.listActionScopeId],
            getState: () => {
                const selectedItems = this.resourceListRef.current?.getSelectedItems() || [];
                if (selectedItems.length === 0) {
                    return {
                        visibility: ActionVisibility.Hidden,
                        disabledReasonText: `No files selected`
                    };
                }
                const { t } = this.context!;
                return {
                    visibility: ActionVisibility.Shown,
                    component: () => <span>{t.common.files.delete(selectedItems.length)}</span>
                };
            }
        };
    }

    componentDidMount = async () => {
        log.debug(`CommandPalette mounted:`, this.props);
        this.registerActionHandler();
    };

    componentDidUpdate = (_prevProps: FileListProps) => {
        log.debug(`CommandPalette props updated:`, this.props);

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
        if (!this.props.filez.filezClient) {
            log.warn(`No filezClient available`);
            return { totalCount: 0, items: [] };
        }

        if (!this.props.filez.clientAuthenticated) {
            log.warn(`Client not authenticated`);
            return { totalCount: 0, items: [] };
        }

        const res = await this.props.filez.filezClient.api.listFilesInFileGroup({
            file_group_id: this.props.fileGroupId,
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
            const result = { totalCount: res.data.data.total_count, items: res.data.data.files };
            return result;
        }

        log.warn(`API response not successful or no data`);
        return { totalCount: 0, items: [] };
    };

    render = () => {
        if (!this.props.filez.clientAuthenticated) {
            return <></>;
        }

        return (
            <div
                data-actionscope={this.listActionScopeId}
                className={cn(`FileList`, this.props.className)}
                style={{ ...this.props.style }}
            >
                <ResourceList<FilezFile>
                    ref={this.resourceListRef}
                    resourceType={`File`}
                    defaultSortBy={`Name`}
                    defaultSortDirection={SortDirection.Ascending}
                    initialRowHandler={`GridListRowHandler`}
                    getResourcesList={this.getFilesList}
                    listInstanceId={this.listId}
                    rowHandlers={[
                        new ColumnListRowHandler({
                            columns: this.defaultColumns
                        }),
                        new GridListRowHandler<FilezFile>({
                            cellRenderer: (item, width, height) => (
                                <FileViewer file={item} width={width} height={height} />
                            )
                        })
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
Delete Files -> 
    - Should only be active when one or more files are selected -> No feedback no display when nothing is selected
    - should only be active when the user has delete permissions -> feedback: disabled action in commandPalette and context menu, toast when hotkey is pressed

If two File lists are open and files are selected in both, the delete action should only delete files from the last focused list

Copy Files
Duplicate Files
Open Files
Open files with

New File
*/

export default withFilez(FileListBase);
