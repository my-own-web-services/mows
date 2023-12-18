import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import ChangeFriendshipStatus from "./ChangeFriendshipStatus";
import ResourceList from "../resource/ResourceList";
import ColumnListRowRenderer from "../resource/ColumnListRowRenderer";
import { Column, ColumnDirection } from "../resource/ResourceListTypes";

const defaultColumns: Column<ReducedFilezUser>[] = [
    {
        field: "name",
        label: "Name",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 30,
        minWidthPixels: 50,
        visible: true,
        render: (item) => {
            return <span style={{ height: "100%" }}>{item.name}</span>;
        }
    },
    {
        field: "role",
        label: "Role",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 30,
        minWidthPixels: 50,
        visible: true,
        render: (item) => {
            return <span style={{ height: "100%" }}>{item.role}</span>;
        }
    },
    {
        field: "status",
        label: "Status",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 30,
        minWidthPixels: 50,
        visible: true,
        render: (item) => {
            return (
                <span style={{ height: "100%" }}>
                    <span>{item.status}</span>
                    <ChangeFriendshipStatus size="sm" user={item} />
                </span>
            );
        }
    }
];

interface UserListProps {
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
}

interface UserListState {}

export default class UserList extends PureComponent<
    UserListProps,
    UserListState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: UserListProps) {
        super(props);
        this.state = {
            list: [],
            listLength: 0,
            commitedSearch: ""
        };
    }

    render = () => {
        if (!this.context) return null;
        return (
            <div className="Filez UserList" style={{ ...this.props.style }}>
                <ResourceList
                    resourceType="User"
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.list_users}
                    //@ts-ignore
                    rowRenderers={[ColumnListRowRenderer]}
                    columns={defaultColumns}
                    displayTopBar={this.props.displayTopBar}
                />
            </div>
        );
    };
}
