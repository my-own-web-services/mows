import { FileGroup, FilezFile } from "@firstdorsal/filez-client";
import { CSSProperties, PureComponent } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import { FilezContext } from "../FilezProvider";
import InfiniteLoader from "react-window-infinite-loader";

interface FilezListProps {
    readonly type: "groups" | "files";
    readonly id?: string;
    readonly style?: CSSProperties;
    readonly rowRenderer?: (item: FilezFile | FileGroup, style: CSSProperties) => JSX.Element;
}

interface FilezListState {
    readonly fileList: FilezFile[];
    readonly groupList: FileGroup[];
    readonly listLength: number;
    readonly initialLoad: boolean;
}

export default class FilezList extends PureComponent<FilezListProps, FilezListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    moreFilesLoading = false;

    constructor(props: FilezListProps) {
        super(props);
        this.state = {
            fileList: [],
            groupList: [],
            initialLoad: false,
            listLength: 0
        };
    }

    componentDidMount = async () => {
        await this.loadData();
    };

    componentDidUpdate = (
        prevProps: Readonly<FilezListProps>,
        prevState: Readonly<FilezListState>
    ) => {
        const filezClient = this?.context?.filezClient;
        // TODO handle updates when (group)id changes
        if (prevState.initialLoad === false && filezClient !== null) {
            this.loadData();
        }
    };

    loadData = async () => {
        if (this.context === null) {
            throw new Error("FilezList must be used inside Filez to provide the FilezContext");
        } else {
            const filezClient = this?.context?.filezClient;

            if (filezClient === null) {
                return;
            }

            if (this.props.type === "groups") {
                const fileGroups = await filezClient.get_own_file_groups();
                this.setState({
                    groupList: fileGroups,
                    initialLoad: true,
                    listLength: fileGroups.length
                });
            } else if (this.props.type === "files") {
                if (this.props.id === undefined) {
                    throw new Error("FilezList type prop must be groups or files");
                }
                const [groups, files] = await Promise.all([
                    filezClient.get_own_file_groups(),
                    filezClient.get_file_infos_by_group_id(this.props.id, 0, 20)
                ]);
                const currentGroup = groups.find(group => group._id === this.props.id);
                if (currentGroup === undefined) {
                    throw new Error("Current group does not exist");
                }
                this.setState({
                    fileList: files,
                    initialLoad: true,
                    listLength: currentGroup.itemCount
                });
            } else {
                throw new Error("FilezList type prop must be groups or files");
            }
        }
    };

    loadMoreFiles = async (startIndex: number, limit: number) => {
        if (this.context === null) {
            throw new Error("FilezList must be used inside Filez to provide the FilezContext");
        } else {
            const filezClient = this?.context?.filezClient;

            if (filezClient === null) {
                return;
            }

            if (this.props.type === "groups") {
                return;
            } else if (this.props.type === "files") {
                if (this.props.id === undefined) {
                    throw new Error("FilezList type prop must be groups or files");
                }
                if (this.moreFilesLoading === false) {
                    this.moreFilesLoading = true;

                    const newFiles = await filezClient.get_file_infos_by_group_id(
                        this.props.id,
                        startIndex,
                        limit
                    );
                    this.moreFilesLoading = false;

                    this.setState(({ fileList }) => {
                        for (let i = 0; i < newFiles.length; i++) {
                            fileList[startIndex + i] = newFiles[i];
                        }
                        return { fileList };
                    });
                }
            } else {
                throw new Error("FilezList type prop must be groups or files");
            }
        }
    };

    render = () => {
        const fullListLength = this.state.listLength;
        const currentListContent =
            this.props.type === "groups" ? this.state.groupList : this.state.fileList;

        return (
            <div className="FilezList" style={this.props.style}>
                <AutoSizer>
                    {({ height, width }) => (
                        <InfiniteLoader
                            isItemLoaded={index => currentListContent[index] !== undefined}
                            itemCount={fullListLength}
                            loadMoreItems={this.loadMoreFiles}
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
                                        const currentItem = currentListContent[index];
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
