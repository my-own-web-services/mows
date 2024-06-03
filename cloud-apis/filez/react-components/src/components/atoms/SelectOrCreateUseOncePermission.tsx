import { PureComponent } from "react";
import { Toggle } from "rsuite";
import Permission from "../resources/Permission";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import ResourcePicker from "./ResourcePicker";
import { FilezContext } from "../../FilezProvider";
import { TagData } from "./MultiItemTagPicker";

interface SelectOrCreateUseOncePermissionProps {
    readonly size?: "lg" | "md" | "sm" | "xs";
    readonly type: "File" | "User" | "UserGroup" | "FileGroup";
    readonly onSelectChange?: (permissionIds: string[]) => void;
    readonly selectedPermissionIds?: string[];
    readonly oncePermissionRef?: React.RefObject<Permission>;
    readonly updateOncePermissionUse: (enabled: boolean) => void;
    readonly useOncePermissionEnabled: boolean;
    readonly useOncePermission?: FilezPermission;
}

interface SelectOrCreateUseOncePermissionState {}

export default class SelectOrCreateUseOncePermission extends PureComponent<
    SelectOrCreateUseOncePermissionProps,
    SelectOrCreateUseOncePermissionState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: SelectOrCreateUseOncePermissionProps) {
        super(props);
    }

    getKnownPermissions = async () => {
        if (!this.context) return [];
        const res = await this.context.filezClient.list_permissions({
            sub_resource_type: this.props.type
        });
        const tags: TagData[] = res.items.map((p) => ({
            value: p._id,
            label: p.name ?? undefined
        }));
        return tags;
    };

    render = () => {
        return (
            <div className="SelectOrCreateUseOncePermission">
                <ResourcePicker
                    size={this.props.size}
                    mode="multi"
                    onMultiChange={this.props.onSelectChange}
                    getKnownTagsFunction={this.getKnownPermissions}
                    initialMultiSelectedValues={
                        this.props.selectedPermissionIds
                    }
                    resourceType="Permission"
                    createResourceComponent={Permission}
                    createComponentProps={{
                        disableTypeChange: true,
                        permissionType: this.props.type
                    }}
                />
                <label htmlFor="">Use Once Permission</label>
                <Toggle
                    size={this.props.size}
                    checked={this.props.useOncePermissionEnabled}
                    onChange={this.props.updateOncePermissionUse}
                />
                {this.props.useOncePermissionEnabled && (
                    <Permission
                        permission={this.props.useOncePermission}
                        ref={this.props.oncePermissionRef}
                        permissionType={this.props.type}
                        disableTypeChange
                        hideTypeChanger
                        useOnce
                    />
                )}
            </div>
        );
    };
}
