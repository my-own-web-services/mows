import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import { cloneDeep } from "lodash";
import { PureComponent } from "react";
import { Input, InputPicker, TagPicker } from "rsuite";
import update from "immutability-helper";
import { FilezContext } from "../../../FilezProvider";
import { match } from "ts-pattern";
import SelectOrCreateUseOncePermission from "../../utils/SelectOrCreateUseOncePermission";
import Permission from "../permissions/Permission";

interface FileGroupProps {
    readonly group?: FilezFileGroup;
    readonly oncePermissionRef?: React.RefObject<Permission>;
}

interface FileGroupState {
    readonly serverGroup: FilezFileGroup;
    readonly clientGroup: FilezFileGroup;
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
    permission_ids: []
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

    create = async (useOncePermissionId?: string) => {
        if (!this.context) return false;
        const cg = this.state.clientGroup;

        if (cg._id === "") {
            const permission_ids = cg.permission_ids;
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

    update = async (
        fieldToUpdate:
            | "Name"
            | "DynamicGroupRules"
            | "GroupType"
            | "Keywords"
            | "MimeTypes"
            | "GroupHierarchyPaths"
    ) => {
        if (!this.context) return false;
        const cg = this.state.clientGroup;

        const res = await this.context.filezClient.update_file_group({
            file_group_id: cg._id,
            // @ts-ignore
            field: {
                [fieldToUpdate]: match(fieldToUpdate)
                    .with("Name", () => cg.name)
                    .with("DynamicGroupRules", () => cg.dynamic_group_rules)
                    .with("GroupType", () => cg.group_type)
                    .with("Keywords", () => cg.keywords)
                    .with("MimeTypes", () => cg.mime_types)
                    .with("GroupHierarchyPaths", () => cg.group_hierarchy_paths)
                    .exhaustive()
            }
        });
        if (res.status === 200) {
            this.setState({ serverGroup: cg });
            return true;
        }

        return false;
    };

    render = () => {
        return (
            <div className="FileGroup">
                <div>
                    <label htmlFor="">Name</label>
                    <Input
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
