import { CSSProperties, PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import {
    bytesToHumanReadableSize,
    utcTimeStampToTimeAndDate
} from "../../../utils";
import {
    Column,
    ColumnDirection,
    ResourceListHandlers,
    ResourceListRowHandlers
} from "../resource/ResourceListTypes";

import FileIcon from "../../fileIcons/FileIcon";
import GridRowRenderer from "../resource/GridRowRenderer";
import ColumnListRowRenderer from "../resource/ColumnListRowRenderer";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { Button, Modal } from "rsuite";
import UploadFile from "./UploadFile";
import MetaEditor from "../../metaEditor/FileMetaEditor";
import ResourceList from "../resource/ResourceList";

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

export default class FileList extends PureComponent<
    FileListProps,
    FileListState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    moreItemsLoading = false;

    resourceListRef = createRef<ResourceList<FilezFile>>();
    uploadFilesRef = createRef<UploadFile>();

    constructor(props: FileListProps) {
        super(props);
        this.state = {
            createModalOpen: false,
            deleteModalOpen: false,
            editModalOpen: false,
            selectedFiles: []
        };
    }

    onDrop = async (
        targetItemId: string,
        targetItemType: string,
        selectedFiles: FilezFile[]
    ) => {
        if (!this.context) return;
        if (targetItemType === "FileGroup") {
            console.log(targetItemId);

            const res = await this.context.filezClient.update_file_infos(
                selectedFiles.flatMap((f) => {
                    if (f.static_file_group_ids.includes(targetItemId))
                        return [];
                    return [
                        {
                            file_id: f._id,
                            fields: {
                                static_file_group_ids: [
                                    ...f.static_file_group_ids,
                                    targetItemId
                                ]
                            }
                        }
                    ];
                })
            );

            if (res.status === 200) {
                this.resourceListRef.current?.refreshList();
                this.props.handlers?.onChange?.();
            }
        }
    };

    onCreateClick = async () => {
        this.setState({ createModalOpen: true });
    };

    closeCreateModal = () => {
        this.setState({ createModalOpen: false });
    };

    closeDeleteModal = () => {
        this.setState({ deleteModalOpen: false });
    };

    uploadClick = async () => {
        if (!this.uploadFilesRef.current) return;
        await this.uploadFilesRef.current.create();
        this.closeCreateModal();
        this.resourceListRef.current?.refreshList();
        this.props.handlers?.onChange?.();
    };

    onContextMenuItemClick = (
        item: FilezFile,
        menuItemId?: string,
        selectedItems?: FilezFile[]
    ) => {
        if (menuItemId === "log") {
            if (selectedItems?.length === 1) {
                console.log(item);
            } else {
                console.log(selectedItems);
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
        const selectedFiles = this.state.selectedFiles;

        for (const file of selectedFiles) {
            // TODO check if file can be deleted or if its readonly
            await this.context.filezClient.delete_file(file._id);
        }

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

    render = () => {
        if (!this.context) return;
        const items = this.state.selectedFiles;
        return (
            <div className="Filez FileList" style={{ ...this.props.style }}>
                <ResourceList
                    ref={this.resourceListRef}
                    resourceType="File"
                    defaultSortField="name"
                    initialListType={"ColumnListRowRenderer"}
                    get_items_function={
                        this.context.filezClient.get_file_infos_by_group_id
                    }
                    dropTargetAcceptsTypes={["File"]}
                    id={this.props.id}
                    //@ts-ignore TODO fix this generic mess
                    rowRenderers={[GridRowRenderer, ColumnListRowRenderer]}
                    displaySortingBar={this.props.displaySortingBar}
                    displayTopBar={this.props.displayTopBar}
                    rowHandlers={{
                        onDrop: this.onDrop,
                        onContextMenuItemClick: this.onContextMenuItemClick,
                        ...this.props.resourceListRowHandlers
                    }}
                    columns={defaultColumns}
                    handlers={{
                        onCreateClick: this.onCreateClick,
                        ...this.props.resourceListHandlers
                    }}
                />

                <Modal
                    open={this.state.createModalOpen}
                    onClose={this.closeCreateModal}
                >
                    <UploadFile ref={this.uploadFilesRef} />
                    <Modal.Footer>
                        <Button onClick={this.uploadClick} appearance="primary">
                            Upload
                        </Button>
                        <Button
                            onClick={this.closeCreateModal}
                            appearance="subtle"
                        >
                            Cancel
                        </Button>
                    </Modal.Footer>
                </Modal>
                <Modal
                    open={this.state.deleteModalOpen}
                    onClose={this.closeDeleteModal}
                >
                    <Modal.Header>
                        <Modal.Title>
                            Delete {items?.length} files? This cannot be undone.
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Footer>
                        <Button
                            onClick={this.deleteClick}
                            appearance="primary"
                            color="red"
                        >
                            Delete
                        </Button>
                        <Button
                            onClick={this.closeDeleteModal}
                            appearance="subtle"
                        >
                            Cancel
                        </Button>
                    </Modal.Footer>
                </Modal>
                <Modal
                    open={this.state.editModalOpen}
                    onClose={this.closeEditModal}
                >
                    <Modal.Header>
                        <Modal.Title>Edit File</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <MetaEditor
                            onChange={this.onEditChange}
                            fileIds={items.map((it) => it._id)}
                        />
                    </Modal.Body>
                </Modal>
            </div>
        );
    };
}
