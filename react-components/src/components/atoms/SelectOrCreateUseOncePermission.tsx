import { PureComponent } from "react";
import SelectPermissions from "./SelectPermissions";
import { Toggle } from "rsuite";
import Permission from "../list/permissions/Permission";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";

interface SelectOrCreateUseOncePermissionProps {
    readonly size?: "lg" | "md" | "sm" | "xs";
    readonly type: "File" | "User" | "UserGroup" | "FileGroup";
    readonly onSelectUpdate?: (permissionIds: string[]) => void;
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
    constructor(props: SelectOrCreateUseOncePermissionProps) {
        super(props);
    }

    render = () => {
        return (
            <div className="SelectOrCreateUseOncePermission">
                <SelectPermissions
                    size={this.props.size}
                    type={this.props.type}
                    onUpdate={(permissionIds) =>
                        this.props.onSelectUpdate?.(permissionIds)
                    }
                    selectedPermissionIds={this.props.selectedPermissionIds}
                />
                <label htmlFor="">Use Once Permission</label>
                <Toggle
                    size={this.props.size}
                    checked={this.props.useOncePermissionEnabled}
                    onChange={(checked) =>
                        this.props.updateOncePermissionUse(checked)
                    }
                />
                {this.props.useOncePermissionEnabled && (
                    <Permission
                        permission={this.props.useOncePermission}
                        ref={this.props.oncePermissionRef}
                        permissionType={this.props.type}
                        disableSaveButton
                        disableTypeChange
                        hideTypeChanger
                        useOnce
                    />
                )}
            </div>
        );
    };
}
