import { PureComponent } from "react";
import SelectPermissions from "./SelectPermissions";
import { Toggle } from "rsuite";
import Permission from "../list/permissions/Permission";

interface SelectOrCreateUseOncePermissionProps {
    readonly size?: "lg" | "md" | "sm" | "xs";
    readonly type: "File" | "User" | "UserGroup" | "FileGroup";
    readonly onUpdate?: (permissionIds: string[]) => void;
    readonly oncePermissionRef?: React.RefObject<Permission>;
}

interface SelectOrCreateUseOncePermissionState {
    readonly showAnon: boolean;
}

export default class SelectOrCreateUseOncePermission extends PureComponent<
    SelectOrCreateUseOncePermissionProps,
    SelectOrCreateUseOncePermissionState
> {
    constructor(props: SelectOrCreateUseOncePermissionProps) {
        super(props);
        this.state = {
            showAnon: false
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
                />
                <label htmlFor="">Use Once Permission</label>
                <Toggle
                    size={this.props.size}
                    checked={this.state.showAnon}
                    onChange={checked => this.setState({ showAnon: checked })}
                />
                {this.state.showAnon && (
                    <Permission
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
