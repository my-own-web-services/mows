import { PureComponent } from "react";
import SelectPermissions from "./SelectPermissions";
import { Toggle } from "rsuite";
import Permission from "../list/permissions/Permission";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";

interface SelectOrCreateUseOncePermissionProps {
    readonly size?: "lg" | "md" | "sm" | "xs";
    readonly type: "File" | "User" | "UserGroup" | "FileGroup";
    readonly onUpdate?: (permissionIds: string[]) => void;
    readonly oncePermissionRef?: React.RefObject<Permission>;
    readonly currentPermissions?: FilezPermission[];
}

interface SelectOrCreateUseOncePermissionState {
    readonly showAnon: boolean;
    readonly anonPermission?: FilezPermission;
}

export default class SelectOrCreateUseOncePermission extends PureComponent<
    SelectOrCreateUseOncePermissionProps,
    SelectOrCreateUseOncePermissionState
> {
    constructor(props: SelectOrCreateUseOncePermissionProps) {
        super(props);
        const anonPermission = this.props.currentPermissions?.find(p => p.use_type === "Once");

        this.state = {
            showAnon: anonPermission ? true : false,
            anonPermission
        };
    }

    handleUpdate = (permissionIds: string[]) => {
        if (this.props.onUpdate) {
            this.props.onUpdate(permissionIds);
        }
    };

    render = () => {
        return (
            <div className="SelectOrCreateUseOncePermission">
                <SelectPermissions
                    size={this.props.size}
                    type={this.props.type}
                    onUpdate={this.handleUpdate}
                    selectedPermissionIds={
                        this.props.currentPermissions?.flatMap(p => {
                            return p.use_type === "Multiple" ? [p._id] : [];
                        }) ?? []
                    }
                />
                <label htmlFor="">Use Once Permission</label>
                <Toggle
                    size={this.props.size}
                    checked={this.state.showAnon}
                    onChange={checked => this.setState({ showAnon: checked })}
                />
                {this.state.showAnon && (
                    <Permission
                        permission={this.state.anonPermission}
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
