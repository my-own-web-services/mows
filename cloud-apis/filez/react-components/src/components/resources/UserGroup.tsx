import { FilezUserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUserGroup";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import { Visibility } from "@firstdorsal/filez-client/dist/js/apiTypes/Visibility";
import { PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";
import { Button, Input, Modal, SelectPicker, TagPicker } from "rsuite";
import SelectOrCreateUseOncePermission from "../atoms/SelectOrCreateUseOncePermission";
import Permission from "./Permission";
import { cloneDeep } from "lodash";
import update from "immutability-helper";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { RsuiteComponentSize } from "../../types";

interface UserGroupProps {
    readonly size?: RsuiteComponentSize;
    readonly enableSaveButton?: boolean;
    readonly readonly?: boolean;
    readonly userGroup?: FilezUserGroup;
    readonly oncePermissionRef?: React.RefObject<Permission>;
    readonly onChange?: (group: FilezUserGroup, invitedUsers: string[]) => void;
    readonly onCreateResourceSuccess?: (id: string) => void;
    readonly onCreateResourceAbort?: () => void;
    readonly creatable?: boolean;
}

interface UserGroupState {
    readonly users: ReducedFilezUser[];
    readonly selectedUsers: string[];
    readonly serverGroup: FilezUserGroup;
    readonly clientGroup: FilezUserGroup;
    readonly availablePermissions?: FilezPermission[];
    readonly useOncePermissionEnabled: boolean;
}

const defaultGroup: FilezUserGroup = {
    _id: "",
    name: "",
    owner_id: "",
    permission_ids: [],
    visibility: "Private"
};

export default class UserGroup extends PureComponent<
    UserGroupProps,
    UserGroupState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: UserGroupProps) {
        super(props);

        const group = props.userGroup ?? defaultGroup;

        this.state = {
            users: [],
            selectedUsers: [],
            clientGroup: cloneDeep(group),
            serverGroup: cloneDeep(group),
            useOncePermissionEnabled: false
        };
    }

    componentDidMount = async () => {
        if (!this.context) return;
        const userRes = await this.context.filezClient.list_users();

        const { items } = await this.context.filezClient.list_permissions({
            sort_field: "name",
            sub_resource_type: "UserGroup"
        });

        const useOncePermission = items?.find((p) => {
            if (
                this.state.clientGroup.permission_ids.includes(p._id) &&
                p.use_type === "Once"
            ) {
                return p;
            }
        });

        this.setState({
            users: userRes.items,
            availablePermissions: items,
            useOncePermissionEnabled: useOncePermission !== undefined
        });
    };
    onNameChange = (value: string) => {
        this.setState(
            update(this.state, {
                clientGroup: {
                    name: { $set: value }
                }
            }),
            this.onChange
        );
    };

    updateVisibility = (value: string | null) => {
        if (value === null) return;
        this.setState(
            update(this.state, {
                clientGroup: {
                    visibility: { $set: value as Visibility }
                }
            }),
            this.onChange
        );
    };

    permissionSelectUpdate = (value: string[]) => {
        this.setState(
            update(this.state, {
                clientGroup: {
                    permission_ids: { $set: value }
                }
            }),
            this.onChange
        );
    };

    updateOncePermissionUse = (value: boolean) => {
        this.setState({ useOncePermissionEnabled: value }, this.onChange);
    };

    updateSelectedUsers = (value: string[]) => {
        this.setState({ selectedUsers: value }, this.onChange);
    };

    onChange = () => {
        this.props.onChange?.(this.state.clientGroup, this.state.selectedUsers);
    };

    createResourceAbort = () => {
        this.props.onCreateResourceAbort?.();
    };

    handleSave = async () => {
        if (!this.context) return;
        const group = this.state.clientGroup;
        const res = await this.context.filezClient.create_user_group({
            name: group.name,
            visibility: group.visibility,
            permission_ids: group.permission_ids
        });

        this.setState({ serverGroup: cloneDeep(this.state.clientGroup) });
        this.props.onCreateResourceSuccess?.(res.group_id);
    };

    render = () => {
        if (this.state.availablePermissions === undefined) return null;
        const cg = this.state.clientGroup;
        return (
            <div className="UserGroup">
                <label>Name</label>
                <Input
                    placeholder="A-Team"
                    value={cg.name ?? ""}
                    onChange={this.onNameChange}
                />
                <br />
                <label>Visibility</label>
                <br />
                <SelectPicker
                    value={cg.visibility}
                    onChange={this.updateVisibility}
                    cleanable={false}
                    searchable={false}
                    data={["Public", "Private"].map((v) => {
                        return { label: v, value: v };
                    })}
                />
                <br />
                <br />
                <div>
                    <label htmlFor="">Permissions</label>
                    <br />
                    <SelectOrCreateUseOncePermission
                        useOncePermissionEnabled={
                            this.state.useOncePermissionEnabled
                        }
                        oncePermissionRef={this.props.oncePermissionRef}
                        onSelectChange={this.permissionSelectUpdate}
                        updateOncePermissionUse={this.updateOncePermissionUse}
                        useOncePermission={
                            this.state.availablePermissions.find((p) => {
                                if (
                                    this.state.clientGroup.permission_ids.includes(
                                        p._id
                                    ) &&
                                    p.use_type === "Once"
                                ) {
                                    return p;
                                }
                            }) ?? undefined
                        }
                        selectedPermissionIds={this.state.availablePermissions.flatMap(
                            (p) => {
                                if (
                                    this.state.clientGroup.permission_ids.includes(
                                        p._id
                                    ) &&
                                    p.use_type === "Multiple"
                                ) {
                                    return [p._id];
                                } else {
                                    return [];
                                }
                            }
                        )}
                        type="UserGroup"
                    />
                </div>
                <label>Members</label>
                <br />

                <TagPicker
                    style={{ width: "300px" }}
                    virtualized
                    value={this.state.selectedUsers}
                    onChange={this.updateSelectedUsers}
                    data={this.state.users.map((u) => {
                        return { label: u.name, value: u._id };
                    })}
                />
                {this.props.readonly !== true &&
                    this.props.creatable === true && (
                        <Modal.Footer className="creatableButtons">
                            <Button
                                onClick={this.handleSave}
                                size={this.props.size}
                                appearance="primary"
                                disabled={this.props.readonly}
                            >
                                Create
                            </Button>
                            <Button
                                appearance="subtle"
                                onClick={this.createResourceAbort}
                            >
                                Cancel
                            </Button>
                        </Modal.Footer>
                    )}
            </div>
        );
    };
}
