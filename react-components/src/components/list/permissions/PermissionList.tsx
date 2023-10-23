import { PureComponent } from "react";
import ResourceList from "../resource/ResourceList";
import { FilezContext } from "../../../FilezProvider";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import CreatePermission from "./CreatePermission";

interface PermissionListProps {
    readonly displayTopBar?: boolean;
    readonly style?: React.CSSProperties;
}

interface PermissionListState {}

export default class PermissionList extends PureComponent<
    PermissionListProps,
    PermissionListState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: PermissionListProps) {
        super(props);
        this.state = {};
    }

    rowRenderer = (permission: FilezPermission, style: any) => {
        return (
            <div className="Filez Row" style={{ ...style }}>
                <div>
                    <span style={{ marginRight: "10px", marginLeft: "10px" }}>
                        {permission.name && permission.name.length
                            ? permission.name
                            : permission._id}
                    </span>
                    <span style={{ marginRight: "10px" }}>{permission.content.type}</span>
                </div>
            </div>
        );
    };

    render = () => {
        if (!this.context) return null;

        return (
            <div className="Filez PermissionList" style={{ ...this.props.style }}>
                <ResourceList
                    createResource={<CreatePermission />}
                    resourceType="Permission"
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.get_own_permissions}
                    rowRenderer={this.rowRenderer}
                    displayTopBar={this.props.displayTopBar}
                />
            </div>
        );
    };
}
