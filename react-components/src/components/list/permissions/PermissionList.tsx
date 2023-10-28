import { PureComponent } from "react";
import ResourceList, { Column, ColumnDirection } from "../resource/ResourceList";
import { FilezContext } from "../../../FilezProvider";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import CreatePermission from "./CreatePermission";

const defaultColumns: Column<FilezPermission>[] = [
    {
        field: "name",
        alternateField: "_id",
        direction: ColumnDirection.ASCENDING,
        width: 50,
        minWidth: 50
    },
    {
        field: "type",
        direction: ColumnDirection.NEUTRAL,
        width: 50,
        minWidth: 50,
        render: (item: FilezPermission) => {
            return <span>{item.content.type}</span>;
        }
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

    rowRenderer = (item: FilezPermission, columns?: Column<FilezPermission>[]) => {
        return (
            <div className="Filez Row">
                {columns?.map((column, index) => {
                    /*@ts-ignore*/
                    const field = item[column.field]
                        ? /*@ts-ignore*/
                          item[column.field]
                        : /*@ts-ignore*/
                          item[column.alternateField];
                    return (
                        <span
                            key={column.field + index}
                            style={{
                                width: column.width + "%",
                                display: "block",
                                float: "left",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                            }}
                        >
                            {column.render
                                ? column.render(item)
                                : field ??
                                  `Field '${column.field}' does not exist on this Permission`}
                        </span>
                    );
                })}
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
                    columns={defaultColumns}
                />
            </div>
        );
    };
}
