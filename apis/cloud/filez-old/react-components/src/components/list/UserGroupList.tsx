import { CSSProperties, PureComponent, createRef } from "react";
import { FilezContext } from "../../FilezProvider";
import ResourceList from "./resource/ResourceList";

import { FilezUserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUserGroup";
import ColumnListRowRenderer from "./resource/rowRenderers/Column";
import {
    Column,
    ColumnDirection,
    ResourceListHandlers,
    ResourceListRowHandlers
} from "./resource/ResourceListTypes";
import { Button, Modal } from "rsuite";
import UserGroup from "../resources/UserGroup";

const defaultColumns: Column<FilezUserGroup>[] = [
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
        field: "visibility",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 33,
        minWidthPixels: 50,
        render: (item) => {
            return <span>{item.visibility}</span>;
        },
        visible: true,
        label: "Visibility"
    }
];

interface UserGroupListProps {
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly handlers?: UserGroupListHandlers;
    readonly resourceListRowHandlers?: ResourceListRowHandlers<FilezUserGroup>;
    readonly resourceListHandlers?: ResourceListHandlers<FilezUserGroup>;
}

export interface UserGroupListHandlers {
    onChange?: () => void;
}

interface UserGroupListState {
    readonly createModalOpen: boolean;
    readonly deleteModalOpen: boolean;
    readonly editModalOpen: boolean;
    readonly selectedUserGroups?: FilezUserGroup[];
    readonly createGroupSelectedUsers?: string[];
    readonly createGroup?: FilezUserGroup;
    readonly editGroupSelectedUsers?: string[];
    readonly editGroup?: FilezUserGroup;
}

export default class UserGroupList extends PureComponent<
    UserGroupListProps,
    UserGroupListState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    resourceListRef = createRef<ResourceList<FilezUserGroup>>();

    constructor(props: UserGroupListProps) {
        super(props);
        this.state = {
            createModalOpen: false,
            deleteModalOpen: false,
            editModalOpen: false
        };
    }

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
        item: FilezUserGroup,
        menuItemId?: string,
        selectedItems?: FilezUserGroup[],
        lastSelectedItem?: FilezUserGroup
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
                selectedUserGroups: selectedItems ?? []
            });
        } else if (menuItemId === "edit") {
            this.setState({
                editModalOpen: true,
                editGroup: lastSelectedItem
            });
        }
    };

    onCreateClick = () => {
        this.setState({ createModalOpen: true });
    };

    createUserGroupClick = async () => {
        if (!this.context) return;
        if (!this.state.createGroup) return;
        await this.context.filezClient.create_user_group(
            this.state.createGroup
        );
        this.resourceListRef.current?.refreshList();

        this.closeCreateModal();
    };

    deleteClick = async () => {
        if (!this.context) return;
        if (!this.state.selectedUserGroups) return;
        await this.context?.filezClient.delete_user_groups(
            this.state.selectedUserGroups.map((p) => p._id)
        );

        this.closeDeleteModal();
        this.resourceListRef.current?.refreshList();
    };

    createChange = (newGroup: FilezUserGroup, invitedUsers: string[]) => {
        this.setState({
            createGroup: newGroup,
            createGroupSelectedUsers: invitedUsers
        });
    };

    editChange = (newGroup: FilezUserGroup, invitedUsers: string[]) => {
        this.setState({
            editGroup: newGroup,
            editGroupSelectedUsers: invitedUsers
        });
    };

    saveEditClick = async () => {
        if (!this.context) return;
        if (!this.state.editGroup) return;
        await this.context.filezClient.update_user_group({
            user_group_id: this.state.editGroup._id,
            fields: {
                name: this.state.editGroup.name,
                visibility: this.state.editGroup.visibility,
                permission_ids: this.state.editGroup.permission_ids
            }
        });
        this.resourceListRef.current?.refreshList();

        this.closeEditModal();
    };

    render = () => {
        if (!this.context) return null;
        const items = this.state.selectedUserGroups;
        return (
            <div
                className="Filez UserGroupList"
                style={{ ...this.props.style }}
            >
                <ResourceList
                    ref={this.resourceListRef}
                    columns={defaultColumns}
                    resourceType="UserGroup"
                    defaultSortField="name"
                    get_items_function={
                        this.context.filezClient.list_user_groups
                    }
                    displayTopBar={this.props.displayTopBar}
                    rowRenderers={[ColumnListRowRenderer<FilezUserGroup>()]}
                    rowHandlers={{
                        onContextMenuItemClick: this.onContextMenuItemClick,
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
                        <Modal.Title>Create User Group</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <UserGroup onChange={this.createChange} />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            onClick={this.createUserGroupClick}
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
                            Delete {items?.length} user groups? This cannot be
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
                <Modal
                    open={this.state.editModalOpen}
                    onClose={this.closeEditModal}
                >
                    <Modal.Header>
                        <Modal.Title>Edit User Group</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <UserGroup
                            onChange={this.editChange}
                            userGroup={this.state.editGroup}
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
            </div>
        );
    };
}
