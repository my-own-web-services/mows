import { FilezUserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUserGroup";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import { Visibility } from "@firstdorsal/filez-client/dist/js/apiTypes/Visibility";
import { PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { Input, SelectPicker, TagPicker } from "rsuite";
import SelectOrCreateUseOncePermission from "../../utils/SelectOrCreateUseOncePermission";
import Permission from "../permissions/Permission";
import { cloneDeep } from "lodash";
import update from "immutability-helper";
interface UserGroupProps {
    readonly group?: FilezUserGroup;
    readonly oncePermissionRef?: React.RefObject<Permission>;
}

interface UserGroupState {
    readonly users: ReducedFilezUser[];
    readonly selectedUsers: string[];
    readonly serverGroup: FilezUserGroup;
    readonly clientGroup: FilezUserGroup;
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
            serverGroup: cloneDeep(group)
        };
    }

    componentDidMount = async () => {
        if (!this.context) return;
        const { items } = await this.context.filezClient.get_user_list({
            filter: "",
            from_index: 0,
            limit: null,
            sort_field: null,
            sort_order: null
        });
        this.setState({ users: items });
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

    update = async (): Promise<boolean> => {
        if (!this.context) return false;
        const cg = this.state.clientGroup;
        const sg = this.state.serverGroup;

        const res = await this.context.filezClient.update_user_group({
            user_group_id: cg._id ?? "",
            fields: {
                name: cg.name === sg.name ? null : cg.name,
                visibility: cg.visibility === sg.visibility ? null : cg.visibility,
                permission_ids: cg.permission_ids === sg.permission_ids ? null : cg.permission_ids
            }
        });
        if (res.status === 200) {
            this.setState({ serverGroup: cg });
            return true;
        } else {
            return false;
        }
    };

    render = () => {
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
                        oncePermissionRef={this.props.oncePermissionRef}
                        onUpdate={value => {
                            this.setState(
                                update(this.state, {
                                    clientGroup: {
                                        permission_ids: { $set: value }
                                    }
                                })
                            );
                        }}
                        type="FileGroup"
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
