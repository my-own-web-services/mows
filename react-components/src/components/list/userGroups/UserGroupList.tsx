import { CSSProperties, PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import InfiniteLoader from "react-window-infinite-loader";
import { UserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/UserGroup";
import ResourceList from "../ResourceList";

interface UserGroupListProps {
    readonly rowRenderer?: (user: UserGroup, style: CSSProperties) => JSX.Element;
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
}

interface UserGroupListState {}

export default class UserGroupList extends PureComponent<UserGroupListProps, UserGroupListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    moreItemsLoading = false;

    infiniteLoaderRef = createRef<InfiniteLoader>();

    constructor(props: UserGroupListProps) {
        super(props);
        this.state = {
            list: [],
            listLength: 0,
            commitedSearch: ""
        };
    }

    rowRenderer = (user_group: UserGroup, style: CSSProperties) => {
        return (
            <div className="Filez Row" style={{ ...style }}>
                <div>
                    <span style={{ marginRight: "10px" }}>{user_group.name ?? user_group._id}</span>
                    <span style={{ marginRight: "10px" }}>{user_group.visibility}</span>
                </div>
            </div>
        );
    };

    render = () => {
        if (!this.context) return null;
        return (
            <div className="Filez UserGroupList" style={{ ...this.props.style }}>
                <ResourceList
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.get_user_group_list}
                    rowRenderer={this.rowRenderer}
                    displayTopBar={this.props.displayTopBar}
                />
            </div>
        );
    };
}
