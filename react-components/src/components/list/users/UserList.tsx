import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import ChangeFriendshipStatus from "./ChangeFriendshipStatus";
import ResourceList from "../resource/ResourceList";

interface UserListProps {
    readonly style?: CSSProperties;
    readonly rowRenderer?: (user: ReducedFilezUser, style: CSSProperties) => JSX.Element;
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

    rowRenderer = (user: ReducedFilezUser) => {
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
                    rowRenderer={this.rowRenderer}
                    displayTopBar={this.props.displayTopBar}
                />
            </div>
        );
    };
}
