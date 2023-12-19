import { CSSProperties, PureComponent, createRef } from "react";
import { FilezContext } from "../../FilezProvider";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import ChangeFriendshipStatus from "../atoms/ChangeFriendshipStatus";
import ResourceList from "./resource/ResourceList";
import ColumnListRowRenderer from "./resource/rowRenderers/Column";
import { Column, ColumnDirection } from "./resource/ResourceListTypes";
import User from "../resources/User";

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
                    <span style={{ marginRight: "5px" }}>{item.status}</span>
                    <ChangeFriendshipStatus size="xs" user={item} />
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

    resourceListRef = createRef<ResourceList<ReducedFilezUser>>();

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
                    ref={this.resourceListRef}
                    resourceType="User"
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.list_users}
                    rowRenderers={[ColumnListRowRenderer<ReducedFilezUser>()]}
                    columns={defaultColumns}
                    displayTopBar={this.props.displayTopBar}
                />
                <User />
            </div>
        );
    };
}
