import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import InfiniteLoader from "react-window-infinite-loader";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import GroupListTopBar from "./GroupListTopBar";
import { AiOutlineFolder, AiOutlineFolderView } from "react-icons/ai";
import { ContextMenu, ContextMenuTrigger, MenuItem } from "react-contextmenu";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";

interface GroupListProps {
    readonly displayTopBar?: boolean;
    readonly style?: CSSProperties;
    readonly rowRenderer?: (item: FilezFileGroup, style: CSSProperties) => JSX.Element;
}

interface GroupListState {
    readonly groupList: FilezFileGroup[];
    readonly listLength: number;
    readonly initialLoad: boolean;
}

export default class GroupList extends PureComponent<GroupListProps, GroupListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    moreFilesLoading = false;

    constructor(props: GroupListProps) {
        super(props);
        this.state = {
            groupList: [],
            initialLoad: false,
            listLength: 0
        };
    }
    componentDidMount = async () => {
        await this.loadData();
    };

    componentDidUpdate = (
        _prevProps: Readonly<GroupListProps>,
        prevState: Readonly<GroupListState>
    ) => {
        const filezClient = this?.context?.filezClient;
        // TODO handle updates when (group)id changes
        if (prevState.initialLoad === false && filezClient !== null) {
            this.loadData();
        }
    };

    loadData = async () => {
        if (this.context === null) {
            throw new Error("FileList must be used inside Filez to provide the FilezContext");
        } else {
            const filezClient = this?.context?.filezClient;

            if (filezClient === null) {
                return;
            }

            const fileGroups = await filezClient.get_own_file_groups();
            this.setState({
                groupList: fileGroups,
                initialLoad: true,
                listLength: fileGroups.length
            });
        }
    };
    loadMoreGroups = async (_startIndex: number, _limit: number) => {};

    handleRightClick = (_e: any, data: any) => {
        console.log(data);
    };

    defaultRowRenderer = (item: FilezFileGroup, style: CSSProperties) => {
        return (
            <div className="DefaultRowRenderer" style={style}>
                <div className="Group">
                    {/*@ts-ignore*/}
                    <ContextMenuTrigger disableIfShiftIsPressed={true} id={item._id}>
                        <div className="GroupItems clickable">
                            <span>
                                {item.group_type === "Static" ? (
                                    <AiOutlineFolder size={20} />
                                ) : (
                                    <AiOutlineFolderView size={20} />
                                )}
                            </span>
                            <span className="itemName">{item.name}</span>
                            <span className="itemCount">{item.item_count}</span>
                        </div>
                    </ContextMenuTrigger>
                    {/*@ts-ignore*/}
                    <ContextMenu id={item._id}>
                        {/*@ts-ignore*/}
                        <MenuItem
                            className="clickable"
                            data={{ _id: item._id }}
                            onClick={() => {
                                console.log(item);
                            }}
                        >
                            <span>Log Group</span>
                        </MenuItem>
                        {/*@ts-ignore*/}
                        <MenuItem
                            className="clickable"
                            data={{ _id: item._id }}
                            onClick={() => {
                                console.log(item);
                            }}
                        >
                            <span>Delete Group</span>
                        </MenuItem>
                    </ContextMenu>
                </div>
            </div>
        );
    };

    render = () => {
        const fullListLength = this.state.listLength;

        return (
            <div className="Filez GroupList" style={{ ...this.props.style }}>
                {this.props.displayTopBar && <GroupListTopBar />}
                <div
                    style={{
                        width: "100%",
                        height: this.props.displayTopBar ? "calc(100% - 40px)" : "100%"
                    }}
                >
                    <AutoSizer>
                        {({ height, width }) => (
                            <InfiniteLoader
                                isItemLoaded={index => this.state.groupList[index] !== undefined}
                                itemCount={fullListLength}
                                loadMoreItems={this.loadMoreGroups}
                                threshold={20}
                                minimumBatchSize={10}
                            >
                                {({ onItemsRendered, ref }) => (
                                    <FixedSizeList
                                        itemSize={20}
                                        height={height}
                                        itemCount={fullListLength}
                                        width={width}
                                        onItemsRendered={onItemsRendered}
                                        ref={ref}
                                        // without this the context menu cannot be positioned fixed
                                        // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                        style={{ willChange: "none" }}
                                    >
                                        {({ index, style }) => {
                                            const currentItem = this.state.groupList[index];
                                            if (!currentItem) {
                                                return <div style={style}>Loading...</div>;
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
            </div>
        );
    };
}
