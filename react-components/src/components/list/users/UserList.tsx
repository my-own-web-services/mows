import { CSSProperties, PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import { AutoSizer, FixedSizeList } from "rsuite/esm/Windowing";
import InfiniteLoader from "react-window-infinite-loader";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import ChangeFriendshipStatus from "./ChangeFriendshipStatus";

interface UserListProps {
    readonly rowRenderer?: (user: ReducedFilezUser, style: CSSProperties) => JSX.Element;
}

interface UserListState {
    readonly userList: ReducedFilezUser[];
    readonly listLength: number;
    readonly commitedSearch: string;
}

export default class UserList extends PureComponent<UserListProps, UserListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    moreItemsLoading = false;

    infiniteLoaderRef = createRef<InfiniteLoader>();

    constructor(props: UserListProps) {
        super(props);
        this.state = {
            userList: [],
            listLength: 0,
            commitedSearch: ""
        };
    }

    componentDidMount = async () => {
        await this.loadItems();
    };

    loadItems = async () => {
        if (!this.context) return;
        if (this.moreItemsLoading) return;

        this.moreItemsLoading = true;

        const filezClient = this.context.filezClient;
        const { users, total_count } = await filezClient.get_user_list(
            0,
            30,
            null,
            null,
            this.state.commitedSearch
        );
        this.setState({
            userList: users,
            listLength: total_count
        });
    };

    loadMoreItems = async (startIndex: number, limit: number) => {
        if (!this.context) return;
        if (this.moreItemsLoading) return;
        const filezClient = this.context.filezClient;

        const { users } = await filezClient.get_user_list(
            startIndex,
            limit,
            null,
            null,
            this.state.commitedSearch
        );

        this.setState(({ userList }) => {
            for (let i = 0; i < users.length; i++) {
                userList[startIndex + i] = users[i];
            }
            return { userList };
        });
    };

    defaultRowRenderer = (user: ReducedFilezUser, style: CSSProperties) => {
        return (
            <div className="Filez Row" style={{ ...style }}>
                <div>
                    <span style={{ marginRight: "10px" }}>{user.name ?? user._id}</span>
                    <span style={{ marginRight: "10px" }}>{user.role}</span>
                    <span style={{ marginRight: "10px" }}>{user.status}</span>
                    <ChangeFriendshipStatus user={user} />
                </div>
            </div>
        );
    };

    render = () => {
        const fullListLength = this.state.listLength;
        return (
            <div className="Filez UserList">
                <AutoSizer>
                    {({ height, width }) => (
                        <InfiniteLoader
                            isItemLoaded={index => this.state.userList[index] !== undefined}
                            itemCount={fullListLength}
                            loadMoreItems={this.loadMoreItems}
                            ref={this.infiniteLoaderRef}
                        >
                            {({ onItemsRendered, ref }) => (
                                <FixedSizeList
                                    itemSize={30}
                                    height={height}
                                    itemCount={fullListLength}
                                    width={width}
                                    onItemsRendered={onItemsRendered}
                                    ref={ref}
                                    // without this the context menu cannot be positioned fixed
                                    // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                    style={{ willChange: "none", overflowY: "scroll" }}
                                >
                                    {({ index, style }) => {
                                        const currentItem = this.state.userList[index];
                                        if (!currentItem) {
                                            return <div style={style}></div>;
                                        }
                                        if (this.props.rowRenderer) {
                                            return this.props.rowRenderer(currentItem, style);
                                        }
                                        return this.defaultRowRenderer(currentItem, style);
                                    }}
                                </FixedSizeList>
                            )}
                        </InfiniteLoader>
                    )}
                </AutoSizer>
            </div>
        );
    };
}
