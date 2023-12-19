import { PureComponent, createRef } from "react";
import {
    Column,
    ColumnDirection,
    ResourceListHandlers,
    ResourceListRowHandlers
} from "./resource/ResourceListTypes";
import { FilezContext } from "../../FilezProvider";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";

import ColumnListRowRenderer from "./resource/rowRenderers/Column";
import ResourceList from "./resource/ResourceList";
import { Button, Modal } from "rsuite";
import Permission from "../resources/Permission";

const defaultColumns: Column<FilezPermission>[] = [
    {
        field: "name",
        alternateField: "_id",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 33,
        minWidthPixels: 50,
        visible: true,
        label: "Name"
    },
    {
        field: "type",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 33,
        minWidthPixels: 50,
        render: (item: FilezPermission) => {
            return <span>{item.content.type}</span>;
        },
        visible: true,
        label: "Type"
    },
    {
        field: "use_type",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 33,
        minWidthPixels: 50,
        render: (item: FilezPermission) => {
            return <span>{item.use_type}</span>;
        },
        visible: true,
        label: "Use Type"
    }
];

interface PermissionListProps {
    readonly displayTopBar?: boolean;
    readonly style?: React.CSSProperties;
    readonly handlers?: PermissionListHandlers;
    readonly resourceListRowHandlers?: ResourceListRowHandlers<FilezPermission>;
    readonly resourceListHandlers?: ResourceListHandlers<FilezPermission>;
}

export interface PermissionListHandlers {
    onChange?: () => void;
}

interface PermissionListState {
    readonly createModalOpen: boolean;
    readonly deleteModalOpen: boolean;
    readonly editModalOpen: boolean;
    readonly selectedPermissions: FilezPermission[];
    readonly createPermission?: FilezPermission;
    readonly editPermission?: FilezPermission;
}

export default class PermissionList extends PureComponent<
    PermissionListProps,
    PermissionListState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    resourceListRef = createRef<ResourceList<FilezPermission>>();

    constructor(props: PermissionListProps) {
        super(props);
        this.state = {
            createModalOpen: false,
            deleteModalOpen: false,
            editModalOpen: false,
            selectedPermissions: []
        };
    }

    openCreateModal = () => {
        this.setState({ createModalOpen: true });
    };

    closeCreateModal = () => {
        this.setState({ createModalOpen: false });
    };

    closeDeleteModal = () => {
        this.setState({ deleteModalOpen: false });
    };

    closeEditModal = () => {
        this.setState({ editModalOpen: false });
    };

    onContextMenuItemClick = (
        item: FilezPermission,
        menuItemId?: string,
        selectedItems?: FilezPermission[],
        lastSelectedItem?: FilezPermission
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
                selectedPermissions: selectedItems ?? []
            });
        } else if (menuItemId === "edit") {
            console.log(lastSelectedItem);

            this.setState({
                editModalOpen: true,
                editPermission: lastSelectedItem
            });
        }
    };

    createPermissionClick = async () => {
        if (!this.context) return;
        const createPermission = this.state.createPermission;
        if (!createPermission) return;
        await this.context.filezClient.create_permission(createPermission);
        this.resourceListRef.current?.refreshList();
        this.props.handlers?.onChange?.();
        this.closeCreateModal();
    };

    deletePermissionClick = async () => {
        if (!this.context) return;
        const selectedPermissions = this.state.selectedPermissions;
        this.closeDeleteModal();

        await this.context.filezClient.delete_permissions(
            selectedPermissions.map((p) => p._id)
        );

        this.closeDeleteModal();
        this.resourceListRef.current?.refreshList();
        this.props.handlers?.onChange?.();
    };

    editSaveClick = async () => {
        if (!this.context) return;
        const editPermission = this.state.editPermission;
        if (!editPermission) return;
        await this.context.filezClient.update_permission({
            content: editPermission.content,
            permission_id: editPermission._id,
            use_type: editPermission.use_type,
            name: editPermission.name
        });
        this.resourceListRef.current?.refreshList();
        this.props.handlers?.onChange?.();
        this.closeEditModal();
    };

    onCreatePermissionChange = (permission: FilezPermission) => {
        this.setState({ createPermission: permission });
    };

    onEditPermissionChange = (permission: FilezPermission) => {
        this.setState({ editPermission: permission });
    };

    render = () => {
        if (!this.context) return null;
        const items = this.state.selectedPermissions;

        return (
            <div
                className="Filez PermissionList"
                style={{ ...this.props.style }}
            >
                <ResourceList
                    ref={this.resourceListRef}
                    resourceType="Permission"
                    defaultSortField="name"
                    get_items_function={
                        this.context.filezClient.list_permissions
                    }
                    displayTopBar={this.props.displayTopBar}
                    rowRenderers={[ColumnListRowRenderer<FilezPermission>()]}
                    columns={defaultColumns}
                    rowHandlers={{
                        onContextMenuItemClick: this.onContextMenuItemClick,
                        ...this.props.resourceListRowHandlers
                    }}
                    handlers={{
                        onCreateClick: this.openCreateModal,
                        ...this.props.resourceListHandlers
                    }}
                />
                <Modal
                    open={this.state.createModalOpen}
                    onClose={this.closeCreateModal}
                >
                    <Modal.Header>
                        <Modal.Title>Create Permission</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Permission
                            disableSaveButton
                            onChange={this.onCreatePermissionChange}
                        />
                    </Modal.Body>

                    <Modal.Footer>
                        <Button
                            onClick={this.createPermissionClick}
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
                    open={this.state.deleteModalOpen}
                    onClose={this.closeDeleteModal}
                >
                    <Modal.Header>
                        <Modal.Title>
                            Delete {items?.length} permissions? This cannot be
                            undone.
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Footer>
                        <Button
                            onClick={this.deletePermissionClick}
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
                        <Modal.Title>Edit Permission</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Permission
                            permission={this.state.editPermission}
                            onChange={this.onEditPermissionChange}
                            hideTypeChanger={true}
                        />
                    </Modal.Body>
                    <Button onClick={this.editSaveClick} appearance="primary">
                        Save
                    </Button>

                    <Button onClick={this.closeEditModal} appearance="subtle">
                        Cancel
                    </Button>
                </Modal>
            </div>
        );
    };
}
