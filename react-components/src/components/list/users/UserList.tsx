import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import ChangeFriendshipStatus from "./ChangeFriendshipStatus";
import ResourceList from "../resource/ResourceList";
import { ListRowProps } from "../resource/ListRow";
import { GridRowProps } from "../resource/GridRow";

interface UserListProps {
    readonly style?: CSSProperties;
    /**
     A function that renders the resource in the list.
     */
    readonly listRowRenderer?: (arg0: ListRowProps<ReducedFilezUser>) => JSX.Element;
    /**
        A function that renders the resource in the list.
        */
    readonly gridRowRenderer?: (arg0: GridRowProps<ReducedFilezUser>) => JSX.Element;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
}

interface UserListState {}

export default class UserList extends PureComponent<UserListProps, UserListState> {
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

    listRowRenderer = (arg0: ListRowProps<ReducedFilezUser>) => {
        const { item: user } = arg0;
        return (
            <div>
                <span style={{ marginRight: "10px" }}>{user.name ?? user._id}</span>
                <span style={{ marginRight: "10px" }}>{user.role}</span>
                <span style={{ marginRight: "10px" }}>{user.status}</span>
                <ChangeFriendshipStatus size="sm" user={user} />
            </div>
        );
    };

    render = () => {
        if (!this.context) return null;
        return (
            <div className="Filez UserList" style={{ ...this.props.style }}>
                <ResourceList
                    resourceType="User"
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.get_user_list}
                    listRowRenderer={
                        this.props.listRowRenderer
                            ? this.props.listRowRenderer
                            : this.listRowRenderer
                    }
                    rowRenderer={this.props.gridRowRenderer}
                    displayTopBar={this.props.displayTopBar}
                />
            </div>
        );
    };
}
