import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import { cloneDeep, isEqual } from "lodash";
import { PureComponent } from "react";
import { Input, InputPicker, TagPicker } from "rsuite";
import update from "immutability-helper";
import { FilezContext } from "../../../FilezProvider";
import SelectOrCreateUseOncePermission from "../../utils/SelectOrCreateUseOncePermission";
import Permission from "../permissions/Permission";
import DynamicGroupRules from "./DynamicGroupRules";
import { FilterRule } from "@firstdorsal/filez-client/dist/js/apiTypes/FilterRule";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";

interface FileGroupProps {
    readonly group?: FilezFileGroup;
    readonly oncePermissionRef?: React.RefObject<Permission>;
}

interface FileGroupState {
    readonly serverGroup: FilezFileGroup;
    readonly clientGroup: FilezFileGroup;
    readonly currentPermissions?: FilezPermission[];
}

const defaultGroup: FilezFileGroup = {
    _id: "",
    name: "",
    group_type: "Static",
    item_count: 0,
    dynamic_group_rules: null,
    group_hierarchy_paths: [],
    keywords: [],
    mime_types: [],
    owner_id: "",
    permission_ids: [],
    readonly: false
};

const defaultDynamicGroupRule: FilterRule = {
    field: "",
    rule_type: "MatchRegex",
    value: ""
};

export default class FileGroup extends PureComponent<FileGroupProps, FileGroupState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: FileGroupProps) {
        super(props);

        const group = props.group ?? defaultGroup;
        this.state = {
            clientGroup: cloneDeep(group),
            serverGroup: cloneDeep(group)
        };
    }

    componentDidMount = async () => {
        if (!this.context) return;
        const { items } = await this.context.filezClient.get_own_permissions({
            filter: "",
            limit: null,
            from_index: 0,
            sort_field: "name",
            sort_order: "Ascending"
        });

        if (items) {
            this.setState({ currentPermissions: items });
        }
    };

    create = async (useOncePermissionId?: string) => {
        if (!this.context) return false;

        const cg = this.state.clientGroup;

        if (cg._id === "") {
            const permission_ids = cloneDeep(cg.permission_ids);
            if (useOncePermissionId) {
                permission_ids.push(useOncePermissionId);
            }
            const res = await this.context.filezClient.create_file_group({
                dynamic_group_rules: cg.dynamic_group_rules,
                group_type: cg.group_type,
                keywords: cg.keywords,
                mime_types: cg.mime_types,
                name: cg.name,
                permission_ids,
                group_hierarchy_paths: cg.group_hierarchy_paths
            });
            if (res.status === 201) {
                this.setState({ serverGroup: cg });
                return true;
            }
        }

        return false;
    };

    update = async (useOncePermissionId?: string) => {
        if (!this.context) return false;
        const cg = this.state.clientGroup;
        const sg = this.state.serverGroup;

        console.log(useOncePermissionId);

        const permission_ids = cloneDeep(cg.permission_ids);
        if (useOncePermissionId) {
            this.setState(
                update(this.state, {
                    clientGroup: {
                        permission_ids: { $push: [useOncePermissionId] }
                    }
                })
            );
            permission_ids.push(useOncePermissionId);
        }

        const res = await this.context.filezClient.update_file_group({
            file_group_id: cg._id,
            fields: {
                dynamic_group_rules: isEqual(cg.dynamic_group_rules, sg.dynamic_group_rules)
                    ? null
                    : cg.dynamic_group_rules,
                group_type: cg.group_type === sg.group_type ? null : cg.group_type,
                keywords: isEqual(cg.keywords, sg.keywords) ? null : cg.keywords,
                mime_types: isEqual(cg.mime_types, sg.mime_types) ? null : cg.mime_types,
                name: cg.name === sg.name ? null : cg.name,
                group_hierarchy_paths: isEqual(cg.group_hierarchy_paths, sg.group_hierarchy_paths)
                    ? null
                    : cg.group_hierarchy_paths,
                permission_ids: isEqual(permission_ids, sg.permission_ids) ? null : permission_ids
            }
        });
        if (res.status === 200) {
            this.setState({ serverGroup: cloneDeep(this.state.clientGroup) });
            return true;
        }

        return false;
    };

    updateRule = (rule: FilterRule) => {
        this.setState(
            update(this.state, {
                clientGroup: {
                    dynamic_group_rules: { $set: rule }
                }
            })
        );
    };

    render = () => {
        if (this.state.currentPermissions === undefined) return null;
        return (
            <div className="FileGroup">
                <div>
                    <label htmlFor="">Name</label>
                    <Input
                        disabled={this.state.clientGroup.readonly ?? false}
                        value={this.state.clientGroup.name ?? ""}
                        onChange={value => {
                            this.setState(
                                update(this.state, {
                                    clientGroup: {
                                        name: { $set: value }
                                    }
                                })
                            );
                        }}
                        placeholder="Name"
                    />
                </div>
                <div>
                    <label htmlFor="">Group Type</label>
                    <br />
                    <InputPicker
                        disabled={this.state.clientGroup.readonly ?? false}
                        data={[
                            {
                                label: "Static",
                                value: "Static"
                            },
                            {
                                label: "Dynamic",
                                value: "Dynamic"
                            }
                        ]}
                        cleanable={false}
                        value={this.state.clientGroup.group_type}
                        onChange={value => {
                            this.setState(
                                update(this.state, {
                                    clientGroup: {
                                        group_type: { $set: value }
                                    }
                                })
                            );
                        }}
                    />
                </div>
                {this.state.clientGroup.group_type === "Dynamic" && (
                    <DynamicGroupRules
                        updateRule={this.updateRule}
                        rule={this.state.clientGroup.dynamic_group_rules ?? defaultDynamicGroupRule}
                    />
                )}
                <div>
                    <label htmlFor="">Keywords</label>
                    <br />
                    <TagPicker
                        data={this.state.clientGroup.keywords.map(keyword => {
                            return {
                                label: keyword,
                                value: keyword
                            };
                        })}
                        creatable
                        onChange={value => {
                            this.setState(
                                update(this.state, {
                                    clientGroup: {
                                        keywords: { $set: value }
                                    }
                                })
                            );
                        }}
                    />
                </div>
                <div>
                    <label htmlFor="">Permissions</label>
                    <br />
                    <SelectOrCreateUseOncePermission
                        oncePermissionRef={this.props.oncePermissionRef}
                        currentPermissions={this.state.currentPermissions}
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
                <div>
                    <label htmlFor="">Mime Types</label>
                    <br />
                    <TagPicker
                        data={this.state.clientGroup.mime_types.map(mime_type => {
                            return {
                                label: mime_type,
                                value: mime_type
                            };
                        })}
                        creatable
                        onChange={value => {
                            this.setState(
                                update(this.state, {
                                    clientGroup: {
                                        mime_types: { $set: value }
                                    }
                                })
                            );
                        }}
                    />
                </div>
            </div>
        );
    };
}
