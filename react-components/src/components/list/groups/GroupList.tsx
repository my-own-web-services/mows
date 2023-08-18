import { FileGroup } from "@firstdorsal/filez-client";
import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import InfiniteLoader from "react-window-infinite-loader";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";

const defaultStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    background: "#111",
    color: "#fff"
};

interface GroupListProps {
    readonly displayTopBar?: boolean;
    readonly style?: CSSProperties;
    readonly rowRenderer?: (item: FileGroup, style: CSSProperties) => JSX.Element;
}

interface GroupListState {
    readonly groupList: FileGroup[];
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
        prevProps: Readonly<GroupListProps>,
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
    loadMoreGroups = async (startIndex: number, limit: number) => {};

    render = () => {
        const fullListLength = this.state.listLength;

        return (
            <div className="GroupList" style={{ ...defaultStyle, ...this.props.style }}>
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
                                >
                                    {({ index, style }) => {
                                        const currentItem = this.state.groupList[index];
                                        if (!currentItem) {
                                            return <div style={style}>Loading...</div>;
                                        }
                                        if (this.props.rowRenderer) {
                                            return this.props.rowRenderer(currentItem, style);
                                        }
                                        return <div style={style}>{currentItem.name}</div>;
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
