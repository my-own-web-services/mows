import { FilezUserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUserGroup";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import { Visibility } from "@firstdorsal/filez-client/dist/js/apiTypes/Visibility";
import { PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { Input, SelectPicker, TagPicker } from "rsuite";
import SelectOrCreateUseOncePermission from "../../utils/SelectOrCreateUseOncePermission";
import Permission from "../permissions/Permission";
import { cloneDeep, isEqual } from "lodash";
import update from "immutability-helper";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
interface UserGroupProps {
    readonly group?: FilezUserGroup;
    readonly oncePermissionRef?: React.RefObject<Permission>;
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

export default class UserGroup extends PureComponent<UserGroupProps, UserGroupState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: UserGroupProps) {
        super(props);

        const group = props.group ?? defaultGroup;

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
        const userRes = await this.context.filezClient.get_user_list({
            filter: "",
            from_index: 0,
            limit: null,
            sort_field: null,
            sort_order: null
        });

        let permissionRes = await this.context.filezClient.get_own_permissions({
            filter: "",
            limit: null,
            from_index: 0,
            sort_field: "name",
            sort_order: "Ascending"
        });

        const permissions = permissionRes.items?.filter(p => p.content.type === "UserGroup");

        const useOncePermission = permissions?.find(p => {
            if (this.state.clientGroup.permission_ids.includes(p._id) && p.use_type === "Once") {
                return p;
            }
        });

        this.setState({
            users: userRes.items,
            availablePermissions: permissions,
            useOncePermissionEnabled: useOncePermission !== undefined
        });
    };

    create = async (useOncePermissionId?: string): Promise<boolean> => {
        if (!this.context) return false;
        const cg = this.state.clientGroup;
        const permission_ids = cloneDeep(cg.permission_ids);
        if (useOncePermissionId) {
            permission_ids.push(useOncePermissionId);
        }

        const res = await this.context.filezClient.create_user_group({
            name: cg.name,
            visibility: cg.visibility,
            permission_ids
        });
        if (res.status === 201) {
            this.setState({ serverGroup: cg });

            return true;
        } else {
            return false;
        }
    };

    update = async (useOncePermissionId?: string): Promise<boolean> => {
        if (!this.context) return false;
        const cg = this.state.clientGroup;
        const sg = this.state.serverGroup;

        let permission_ids = cloneDeep(cg.permission_ids);
        if (useOncePermissionId) {
            this.setState(
                update(this.state, {
                    clientGroup: {
                        permission_ids: { $push: [useOncePermissionId] }
                    }
                })
            );
            permission_ids.push(useOncePermissionId);
        } else {
            const useOncePermission = this.state.availablePermissions?.find(p => {
                if (cg.permission_ids.includes(p._id) && p.use_type === "Once") {
                    return p;
                }
            });

            console.log(useOncePermission);

            if (useOncePermission) {
                permission_ids = permission_ids.filter(id => id !== useOncePermission._id);

                this.context.filezClient.delete_permission(useOncePermission?._id);

                this.setState(
                    update(this.state, {
                        clientGroup: {
                            permission_ids: { $set: permission_ids }
                        }
                    })
                );
            }
        }

        const res = await this.context.filezClient.update_user_group({
            user_group_id: cg._id ?? "",
            fields: {
                name: cg.name === sg.name ? null : cg.name,
                visibility: cg.visibility === sg.visibility ? null : cg.visibility,
                permission_ids: isEqual(permission_ids, sg.permission_ids) ? null : permission_ids
            }
        });
        if (res.status === 200) {
            this.setState({ serverGroup: cloneDeep(this.state.clientGroup) });
            return true;
        } else {
            return false;
        }
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
                    onChange={value => {
                        this.setState(
                            update(this.state, {
                                clientGroup: {
                                    name: { $set: value }
                                }
                            })
                        );
                    }}
                />
                <br />
                <label>Visibility</label>
                <br />
                <SelectPicker
                    value={cg.visibility}
                    onChange={value => {
                        this.setState(
                            update(this.state, {
                                clientGroup: {
                                    visibility: { $set: value as Visibility }
                                }
                            })
                        );
                    }}
                    cleanable={false}
                    searchable={false}
                    data={["Public", "Private"].map(v => {
                        return { label: v, value: v };
                    })}
                />
                <br />
                <br />
                <div>
                    <label htmlFor="">Permissions</label>
                    <br />
                    <SelectOrCreateUseOncePermission
                        useOncePermissionEnabled={this.state.useOncePermissionEnabled}
                        oncePermissionRef={this.props.oncePermissionRef}
                        onSelectUpdate={value => {
                            this.setState(
                                update(this.state, {
                                    clientGroup: {
                                        permission_ids: { $set: value }
                                    }
                                })
                            );
                        }}
                        updateOncePermissionUse={enabled => {
                            this.setState({ useOncePermissionEnabled: enabled });
                        }}
                        useOncePermission={
                            this.state.availablePermissions.find(p => {
                                if (
                                    this.state.clientGroup.permission_ids.includes(p._id) &&
                                    p.use_type === "Once"
                                ) {
                                    return p;
                                }
                            }) ?? undefined
                        }
                        selectedPermissionIds={this.state.availablePermissions.flatMap(p => {
                            if (
                                this.state.clientGroup.permission_ids.includes(p._id) &&
                                p.use_type === "Multiple"
                            ) {
                                return [p._id];
                            } else {
                                return [];
                            }
                        })}
                        type="UserGroup"
                    />
                </div>
                <label> Members</label>
                <br />

                <TagPicker
                    style={{ width: "300px" }}
                    virtualized
                    value={this.state.selectedUsers}
                    onChange={value => {
                        this.setState({ selectedUsers: value });
                    }}
                    data={this.state.users.map(u => {
                        return { label: u.name, value: u._id };
                    })}
                />
            </div>
        );
    };
}
