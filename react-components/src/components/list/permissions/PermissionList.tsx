import { PureComponent } from "react";
import ResourceList, { Column, ColumnDirection } from "../resource/ResourceList";
import { FilezContext } from "../../../FilezProvider";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import CreatePermission from "./CreatePermission";
import EditPermission from "./EditPermission";
import { ListRowProps } from "../resource/ListRow";
import { GridRowProps } from "../resource/GridRow";

const defaultColumns: Column<FilezPermission>[] = [
    {
        field: "name",
        alternateField: "_id",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 33,
        minWidthPixels: 50,
        visible: true
    },
    {
        field: "type",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 33,
        minWidthPixels: 50,
        render: (item: FilezPermission) => {
            return <span>{item.content.type}</span>;
        },
        visible: true
    },
    {
        field: "use_type",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 33,
        minWidthPixels: 50,
        render: (item: FilezPermission) => {
            return <span>{item.use_type}</span>;
        },
        visible: true
    }
];

interface PermissionListProps {
    readonly displayTopBar?: boolean;
    readonly style?: React.CSSProperties;
    /**
     A function that renders the resource in the list.
     */
    readonly listRowRenderer?: (arg0: ListRowProps<FilezPermission>) => JSX.Element;
    /**
         A function that renders the resource in the list.
         */
    readonly gridRowRenderer?: (arg0: GridRowProps<FilezPermission>) => JSX.Element;
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
                    listRowRenderer={this.props.listRowRenderer}
                    rowRenderer={this.props.gridRowRenderer}
                    columns={defaultColumns}
                />
            </div>
        );
    };
}
