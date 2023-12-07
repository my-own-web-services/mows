import { PureComponent } from "react";
import ResourceList, { Column, ColumnDirection } from "../resource/ResourceList";
import { FilezContext } from "../../../FilezProvider";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import CreatePermission from "./CreatePermission";
import EditPermission from "./EditPermission";
import ColumnListRowRenderer from "../resource/ColumnListRowRenderer";

const defaultColumns: Column<FilezPermission>[] = [
    {
        field: "name",
        alternateField: "_id",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 33,
        minWidthPixels: 50,
        visible: true,
        label: "Name"
    },
    {
        field: "type",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 33,
        minWidthPixels: 50,
        render: (item: FilezPermission) => {
            return <span>{item.content.type}</span>;
        },
        visible: true,
        label: "Type"
    },
    {
        field: "use_type",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 33,
        minWidthPixels: 50,
        render: (item: FilezPermission) => {
            return <span>{item.use_type}</span>;
        },
        visible: true,
        label: "Use Type"
    }
];

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

    render = () => {
        if (!this.context) return null;

        return (
            <div className="Filez PermissionList" style={{ ...this.props.style }}>
                <ResourceList
                    createResource={<CreatePermission />}
                    editResource={<EditPermission />}
                    resourceType="Permission"
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.get_own_permissions}
                    displayTopBar={this.props.displayTopBar}
                    rowRenderers={[ColumnListRowRenderer]}
                    columns={defaultColumns}
                />
            </div>
        );
    };
}
