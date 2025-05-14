import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import { cloneDeep } from "lodash";
import { PureComponent } from "react";
import { Button, Input, InputPicker, Modal, TagPicker } from "rsuite";
import update from "immutability-helper";
import { FilezContext } from "../../FilezProvider";
import SelectOrCreateUseOncePermission from "../atoms/SelectOrCreateUseOncePermission";
import Permission from "./Permission";
import DynamicGroupRules from "../atoms/DynamicGroupRules";
import { FilterRule } from "@firstdorsal/filez-client/dist/js/apiTypes/FilterRule";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { FileGroupType } from "@firstdorsal/filez-client/dist/js/apiTypes/FileGroupType";
import { RsuiteComponentSize } from "../../types";

interface FileGroupProps {
    readonly size?: RsuiteComponentSize;
    readonly creatable?: boolean;
    readonly style?: React.CSSProperties;
    readonly readonly?: boolean;
    readonly groups?: FilezFileGroup[];
    readonly oncePermissionRef?: React.RefObject<Permission>;
    readonly serverUpdate?: boolean;
    readonly onChange?: (group: FilezFileGroup) => void;
    readonly onCreateResourceSuccess?: (id: string) => void;
    readonly onCreateResourceAbort?: () => void;
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
    readonly: false,
    all: false,
    deletable: false
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
        const { items } = await this.context.filezClient.list_permissions({
            sort_field: "name",
            sub_resource_type: "FileGroup"
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

    handleSave = async () => {
        if (!this.context) return;
        const cfgrb = await this.context.filezClient.create_file_group(
            this.state.clientGroup
        );
        this.props.onCreateResourceSuccess?.(cfgrb.group_id);
    };

    createResourceAbort = () => {
        this.props.onCreateResourceAbort?.();
    };

    updateOncePermissionUse = (enabled: boolean) => {
        this.setState(
            {
                useOncePermissionEnabled: enabled
            },
            this.onChange
        );
    };

    onSelectPermissionChange = (permissionIds: string[]) => {
        this.setState(
            update(this.state, {
                clientGroup: {
                    permission_ids: { $set: permissionIds }
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
                    TODO
                </div>
                <div>
                    <label htmlFor="">Permissions</label>
                    <br />
                    <SelectOrCreateUseOncePermission
                        useOncePermissionEnabled={
                            this.state.useOncePermissionEnabled
                        }
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
                        selectedPermissionIds={
                            this.state.availablePermissions.flatMap((p) => {
                                if (
                                    this.state.clientGroup.permission_ids.includes(
                                        p._id
                                    ) &&
                                    p.use_type === "Multiple"
                                ) {
                                    return [p._id];
                                }
                                return [];
                            }) ?? []
                        }
                        oncePermissionRef={this.props.oncePermissionRef}
                        onSelectChange={this.onSelectPermissionChange}
                        type="FileGroup"
                    />
                </div>
                <div>
                    <label htmlFor="">Mime Types</label>
                    <br />
                    TODO
                </div>
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
                            <Button onClick={this.createResourceAbort}>
                                Cancel
                            </Button>
                        </Modal.Footer>
                    )}
            </div>
        );
    };
}
