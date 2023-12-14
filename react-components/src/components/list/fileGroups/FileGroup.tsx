import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import { cloneDeep } from "lodash";
import { PureComponent } from "react";
import { Input, InputPicker, TagPicker } from "rsuite";
import update from "immutability-helper";
import { FilezContext } from "../../../FilezProvider";
import SelectOrCreateUseOncePermission from "../atoms/SelectOrCreateUseOncePermission";
import Permission from "../permissions/Permission";
import DynamicGroupRules from "./DynamicGroupRules";
import { FilterRule } from "@firstdorsal/filez-client/dist/js/apiTypes/FilterRule";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { FileGroupType } from "@firstdorsal/filez-client/dist/js/apiTypes/FileGroupType";

interface FileGroupProps {
    readonly groups?: FilezFileGroup[];
    readonly oncePermissionRef?: React.RefObject<Permission>;
    readonly serverUpdate?: boolean;
    readonly onChange?: (group: FilezFileGroup) => void;
}

interface FileGroupState {
    readonly serverGroup: FilezFileGroup;
    readonly clientGroup: FilezFileGroup;
    readonly availablePermissions?: FilezPermission[];
    readonly useOncePermissionEnabled: boolean;
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

export default class FileGroup extends PureComponent<
    FileGroupProps,
    FileGroupState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: FileGroupProps) {
        super(props);

        const group = props.groups ?? [defaultGroup];
        this.state = {
            clientGroup: cloneDeep(group[0]),
            serverGroup: cloneDeep(group[0]),
            useOncePermissionEnabled: false
        };
    }

    componentDidMount = async () => {
        if (!this.context) return;
        const { items } = await this.context.filezClient.get_own_permissions(
            {
                sort_field: "name"
            },
            "FileGroup"
        );

        const useOncePermission = items?.find((p) => {
            if (
                this.state.clientGroup.permission_ids.includes(p._id) &&
                p.use_type === "Once"
            ) {
                return p;
            }
        });

        this.setState({
            availablePermissions: items,
            useOncePermissionEnabled: useOncePermission !== undefined
        });
    };

    onChange = () => {
        this.props.onChange?.(this.state.clientGroup);
    };

    updateRule = (rule: FilterRule) => {
        this.setState(
            update(this.state, {
                clientGroup: {
                    dynamic_group_rules: { $set: rule }
                }
            }),
            this.onChange
        );
    };

    nameChange = (value: string) => {
        this.setState(
            update(this.state, {
                clientGroup: {
                    name: { $set: value }
                }
            }),
            this.onChange
        );
    };

    groupTypeChange = (value: string) => {
        this.setState(
            update(this.state, {
                clientGroup: {
                    group_type: { $set: value as FileGroupType }
                }
            }),
            this.onChange
        );
    };

    render = () => {
        if (this.state.availablePermissions === undefined) return null;
        return (
            <div className="FileGroup">
                <div>
                    <label htmlFor="">Name</label>
                    <Input
                        disabled={this.state.clientGroup.readonly ?? false}
                        value={this.state.clientGroup.name ?? ""}
                        onChange={this.nameChange}
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
                        onChange={this.groupTypeChange}
                    />
                </div>
                {this.state.clientGroup.group_type === "Dynamic" && (
                    <DynamicGroupRules
                        updateRule={this.updateRule}
                        rule={
                            this.state.clientGroup.dynamic_group_rules ??
                            defaultDynamicGroupRule
                        }
                    />
                )}
                <div>
                    <label htmlFor="">Keywords</label>
                    <br />
                    <TagPicker
                        data={this.state.clientGroup.keywords.map((keyword) => {
                            return {
                                label: keyword,
                                value: keyword
                            };
                        })}
                        creatable
                        onChange={(value) => {
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
                        useOncePermissionEnabled={
                            this.state.useOncePermissionEnabled
                        }
                        updateOncePermissionUse={(enabled) => {
                            this.setState({
                                useOncePermissionEnabled: enabled
                            });
                        }}
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
                        selectedPermissionIds={
                            this.state.availablePermissions
                                .filter((p) => {
                                    if (
                                        this.state.clientGroup.permission_ids.includes(
                                            p._id
                                        ) &&
                                        p.use_type === "Multiple"
                                    ) {
                                        return p;
                                    }
                                })
                                .map((p) => p._id) ?? []
                        }
                        oncePermissionRef={this.props.oncePermissionRef}
                        onSelectUpdate={(value) => {
                            console.log(value);

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
                        data={this.state.clientGroup.mime_types.map(
                            (mime_type) => {
                                return {
                                    label: mime_type,
                                    value: mime_type
                                };
                            }
                        )}
                        creatable
                        onChange={(value) => {
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
