import { FilezFile } from "@firstdorsal/filez-client";
import { CSSProperties, PureComponent } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import { FilezContext } from "../../../FilezProvider";
import InfiniteLoader from "react-window-infinite-loader";
import FileListTopBar from "./FileListTopBar";
import { ContextMenu, ContextMenuTrigger, MenuItem } from "react-contextmenu";

interface FileListProps {
    readonly id?: string;
    readonly style?: CSSProperties;
    readonly rowRenderer?: (item: FilezFile, style: CSSProperties) => JSX.Element;
    /**
     * Default Row Renderer onClick handler
     */
    readonly drrOnClick?: (item: FilezFile) => void;
    readonly displayTopBar?: boolean;
}

interface FileListState {
    readonly fileList: FilezFile[];
    readonly listLength: number;
    readonly initialLoad: boolean;
}

export default class FileList extends PureComponent<FileListProps, FileListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    moreFilesLoading = false;

    constructor(props: FileListProps) {
        super(props);
        this.state = {
            fileList: [],
            initialLoad: false,
            listLength: 0
        };
    }

    componentDidMount = async () => {
        await this.loadData();
    };

    componentDidUpdate = (
        prevProps: Readonly<FileListProps>,
        prevState: Readonly<FileListState>
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

            if (this.props.id === undefined) {
                throw new Error("File list has no id");
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
        }
    };

    loadMoreFiles = async (startIndex: number, limit: number) => {
        if (this.context === null) {
            throw new Error("FileList must be used inside Filez to provide the FilezContext");
        } else {
            const filezClient = this?.context?.filezClient;

            if (filezClient === null) {
                return;
            }

            if (this.props.id === undefined) {
                throw new Error("File list has no id");
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
        }
    };

    defaultRowRenderer = (item: FilezFile, style: CSSProperties) => {
        return (
            <div
                className="DefaultRowRenderer"
                onClick={() => this.props.drrOnClick && this.props.drrOnClick(item)}
            >
                {/*@ts-ignore*/}
                <ContextMenuTrigger disableIfShiftIsPressed={true} id={item._id}>
                    <div className="clickable" style={style}>
                        {item.name}
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
                        <span>Log File</span>
                    </MenuItem>
                </ContextMenu>
            </div>
        );
    };

    render = () => {
        const fullListLength = this.state.listLength;

        return (
            <div className="Filez FileList" style={{ ...this.props.style }}>
                {this.props.displayTopBar && <FileListTopBar />}
                <div
                    style={{
                        width: "100%",
                        height: this.props.displayTopBar ? "calc(100% - 40px)" : "100%"
                    }}
                >
                    <AutoSizer>
                        {({ height, width }) => (
                            <InfiniteLoader
                                isItemLoaded={index => this.state.fileList[index] !== undefined}
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
                                        // without this the context menu cannot be positioned fixed
                                        // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                        style={{ willChange: "none" }}
                                    >
                                        {({ index, style }) => {
                                            const currentItem = this.state.fileList[index];
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
