import { CSSProperties, PureComponent, createRef } from "react";
import { FilezContext } from "../../FilezProvider";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import ChangeFriendshipStatus from "../atoms/ChangeFriendshipStatus";
import ResourceList from "./resource/ResourceList";
import ColumnListRowRenderer from "./resource/rowRenderers/Column";
import {
    Column,
    ColumnDirection,
    ResourceListHandlers,
    ResourceListRowHandlers
} from "./resource/ResourceListTypes";
import User from "../resources/User";
import { Button, Modal } from "rsuite";
import { FilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUser";

const defaultColumns: Column<ReducedFilezUser>[] = [
    {
        field: "name",
        label: "Name",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 30,
        minWidthPixels: 50,
        visible: true,
        render: (item) => {
            return (
                <span style={{ height: "100%" }}>{item.name ?? item._id}</span>
            );
        }
    },
    {
        field: "role",
        label: "Role",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 30,
        minWidthPixels: 50,
        visible: true,
        render: (item) => {
            return <span style={{ height: "100%" }}>{item.role}</span>;
        }
    },
    {
        field: "status",
        label: "Status",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 30,
        minWidthPixels: 50,
        visible: true,
        render: (item) => {
            return (
                <span style={{ height: "100%" }}>
                    <span style={{ marginRight: "5px" }}>{item.status}</span>
                    <ChangeFriendshipStatus size="xs" user={item} />
                </span>
            );
        }
    }
];

interface UserListProps {
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly resourceListRowHandlers?: ResourceListRowHandlers<ReducedFilezUser>;
    readonly resourceListHandlers?: ResourceListHandlers<ReducedFilezUser>;
    readonly handlers?: UserListHandlers;
}

export interface UserListHandlers {
    onChange?: () => void;
}

interface UserListState {
    readonly createModalOpen: boolean;
    readonly deleteModalOpen: boolean;
    readonly editModalOpen: boolean;
    readonly selectedUsers: ReducedFilezUser[];
    readonly ownUser?: FilezUser;
}

export default class UserList extends PureComponent<
    UserListProps,
    UserListState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    resourceListRef = createRef<ResourceList<ReducedFilezUser>>();

    constructor(props: UserListProps) {
        super(props);
        this.state = {
            createModalOpen: false,
            deleteModalOpen: false,
            editModalOpen: false,
            selectedUsers: []
        };
    }

    componentDidMount = async () => {
        if (!this.context) return;
        const urb = await this.context.filezClient.get_users();
        const ownUser = urb.full_users?.[0];
        this.setState({ ownUser });
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
        item: ReducedFilezUser,
        menuItemId?: string,
        selectedItems?: ReducedFilezUser[]
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
                selectedUsers: selectedItems ?? []
            });
        } else if (menuItemId === "edit") {
            this.setState({
                editModalOpen: true,
                selectedUsers: selectedItems ?? []
            });
        }
    };

    listCreateClick = () => {
        this.setState({ createModalOpen: true });
    };

    createUserClick = async () => {};
    deleteUsersClick = async () => {};

    render = () => {
        if (!this.context) return null;
        const items = this.state.selectedUsers;

        return (
            <div className="Filez UserList" style={{ ...this.props.style }}>
                <ResourceList
                    ref={this.resourceListRef}
                    resourceType="User"
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.list_users}
                    rowRenderers={[ColumnListRowRenderer<ReducedFilezUser>()]}
                    columns={defaultColumns}
                    displayTopBar={this.props.displayTopBar}
                    rowHandlers={{
                        onContextMenuItemClick: this.onContextMenuItemClick,
                        ...this.props.resourceListRowHandlers
                    }}
                    handlers={{
                        onCreateClick: this.listCreateClick,
                        ...this.props.resourceListHandlers
                    }}
                />
                <Modal
                    open={this.state.createModalOpen}
                    onClose={this.closeCreateModal}
                >
                    <Modal.Header>
                        <Modal.Title>Create User</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <User requestingUser={this.state.ownUser} />
                    </Modal.Body>

                    <Modal.Footer>
                        <Button
                            onClick={this.createUserClick}
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
                            Delete {items?.length} users? This cannot be undone.
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Footer>
                        <Button
                            onClick={this.deleteUsersClick}
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
                        <Modal.Title>Edit User</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <User />
                    </Modal.Body>
                </Modal>
            </div>
        );
    };
}
