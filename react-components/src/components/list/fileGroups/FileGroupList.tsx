import { CSSProperties, PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import {
    Column,
    ColumnDirection,
    ResourceListHandlers,
    ResourceListRowHandlers
} from "../resource/ResourceListTypes";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import { Button, Modal } from "rsuite";
import ColumnListRowRenderer from "../resource/ColumnListRowRenderer";
import { AiOutlineFolder, AiOutlineFolderView } from "react-icons/ai";
import ResourceList from "../resource/ResourceList";
import FileGroup from "./FileGroup";

const defaultColumns: Column<FilezFileGroup>[] = [
    {
        field: "name",
        label: "Name",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 100,
        minWidthPixels: 50,
        visible: true,
        render: (item: FilezFileGroup) => {
            const style: CSSProperties = {
                display: "block",
                float: "left",
                marginRight: "5px"
            };
            return (
                <span>
                    <span style={style}>
                        {item?.group_type === "Static" ? (
                            <AiOutlineFolder size={20} />
                        ) : (
                            <AiOutlineFolderView size={20} />
                        )}
                    </span>
                    <span style={style}>{item.name}</span>
                    <span style={{ ...style, opacity: "50%" }}>
                        {item.item_count}
                    </span>
                </span>
            );
        }
    }
];

interface FileGroupListProps {
    readonly displayTopBar?: boolean;
    readonly style?: CSSProperties;
    readonly resourceListRowHandlers?: ResourceListRowHandlers<FilezFileGroup>;
    readonly resourceListHandlers?: ResourceListHandlers<FilezFileGroup>;
    readonly handlers?: FileGroupListHandlers;
}

export interface FileGroupListHandlers {
    onChange?: () => void;
}

interface FileGroupListState {
    readonly deleteModalOpen: boolean;
    readonly editModalOpen: boolean;
    readonly createModalOpen: boolean;
    readonly selectedFileGroups?: FilezFileGroup[];
    readonly newFileGroup?: FilezFileGroup;
    readonly groupsToEdit?: FilezFileGroup[];
}

export default class FileGroupList extends PureComponent<
    FileGroupListProps,
    FileGroupListState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    resourceListRef = createRef<ResourceList<FilezFileGroup>>();

    constructor(props: FileGroupListProps) {
        super(props);
        this.state = {
            deleteModalOpen: false,
            editModalOpen: false,
            createModalOpen: false
        };
    }

    openEditModal = () => {
        this.setState({ editModalOpen: true });
    };

    closeEditModal = () => {
        this.setState({ editModalOpen: false });
    };

    openDeleteModal = () => {
        this.setState({ deleteModalOpen: true });
    };

    closeDeleteModal = () => {
        this.setState({ deleteModalOpen: false });
    };

    openCreateModal = () => {
        this.setState({ createModalOpen: true });
    };

    closeCreateModal = () => {
        this.setState({ createModalOpen: false });
    };

    deleteClick = async () => {
        if (!this.context) return;
        const items = this.resourceListRef.current?.getSelectedItems();
        if (!items) return;
        await this.context.filezClient.delete_file_groups(
            items.map((i) => i._id)
        );

        this.resourceListRef.current?.refreshList();
        this.closeDeleteModal();
    };

    onContextMenuItemClick = (
        item: FilezFileGroup,
        menuItemId: string,
        selectedItems: FilezFileGroup[],
        lastSelectedItem: FilezFileGroup
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
                selectedFileGroups: selectedItems ?? []
            });
        } else if (menuItemId === "edit") {
            this.setState({
                editModalOpen: true,
                selectedFileGroups: selectedItems ?? [],
                groupsToEdit: [lastSelectedItem]
            });
        }
    };

    onCreateClick = async () => {
        this.setState({ createModalOpen: true });
    };

    isDroppable = (item: FilezFileGroup) => {
        if (item.readonly || item.group_type === "Dynamic") return false;
        return true;
    };

    createGroupClick = async () => {
        if (!this.context) return false;

        const cg = this.state.newFileGroup;
        if (!cg) return false;

        const res = await this.context.filezClient.create_file_group({
            dynamic_group_rules: cg.dynamic_group_rules,
            group_type: cg.group_type,
            keywords: cg.keywords,
            mime_types: cg.mime_types,
            name: cg.name,
            permission_ids: [],
            group_hierarchy_paths: cg.group_hierarchy_paths
        });
        if (res.group_id) {
            this.props.handlers?.onChange?.();
            this.resourceListRef.current?.refreshList();
            this.closeCreateModal();
        }
    };

    newFileGroupChange = (fileGroup: FilezFileGroup) => {
        this.setState({ newFileGroup: fileGroup });
    };

    saveEditClick = async () => {
        if (!this.context) return false;

        const cg = this.state.newFileGroup;
        if (!cg) return false;

        const res = await this.context.filezClient.update_file_group({
            file_group_id: cg._id,
            fields: {
                dynamic_group_rules: cg.dynamic_group_rules,
                group_type: cg.group_type,
                keywords: cg.keywords,
                mime_types: cg.mime_types,
                name: cg.name,
                permission_ids: cg.permission_ids,
                group_hierarchy_paths: cg.group_hierarchy_paths
            }
        });
        if (res.status === 200) {
            this.props.handlers?.onChange?.();
            this.resourceListRef.current?.refreshList();
            this.closeEditModal();
        }
    };

    render = () => {
        if (!this.context) return null;
        const items = this.state.selectedFileGroups;

        return (
            <div
                className="Filez FileGroupList"
                style={{ ...this.props.style }}
            >
                <ResourceList
                    ref={this.resourceListRef}
                    resourceType="FileGroup"
                    defaultSortField="name"
                    dropTargetAcceptsTypes={["File"]}
                    get_items_function={
                        this.context.filezClient.get_own_file_groups
                    }
                    //@ts-ignore TODO fix this generic mess
                    rowRenderers={[ColumnListRowRenderer]}
                    displayTopBar={this.props.displayTopBar}
                    columns={defaultColumns}
                    rowHandlers={{
                        onContextMenuItemClick: this.onContextMenuItemClick,
                        isDroppable: this.isDroppable,
                        ...this.props.resourceListRowHandlers
                    }}
                    handlers={{
                        onCreateClick: this.onCreateClick,
                        ...this.props.resourceListHandlers
                    }}
                />
                <Modal
                    open={this.state.createModalOpen}
                    onClose={this.closeCreateModal}
                >
                    <Modal.Header>
                        <Modal.Title>Create File Group</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <FileGroup
                            onChange={this.newFileGroupChange}
                            serverUpdate={false}
                        />
                    </Modal.Body>

                    <Modal.Footer>
                        <Button
                            onClick={this.createGroupClick}
                            appearance="primary"
                        >
                            Create
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
                    open={this.state.editModalOpen}
                    onClose={this.closeEditModal}
                >
                    <Modal.Header>
                        <Modal.Title>Edit File Group</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <FileGroup
                            groups={this.state.groupsToEdit}
                            onChange={this.newFileGroupChange}
                        />
                    </Modal.Body>

                    <Modal.Footer>
                        <Button
                            onClick={this.saveEditClick}
                            appearance="primary"
                        >
                            Save
                        </Button>
                        <Button
                            onClick={this.closeEditModal}
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
                            Delete {items?.length} file groups? This cannot be
                            undone.
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
            </div>
        );
    };
}
