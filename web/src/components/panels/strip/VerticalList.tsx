import { Component } from "preact";
import { CSSProperties, forwardRef } from "preact/compat";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList as List } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
import { G } from "../../../App";
import { FilezFile } from "../../../types";
import ListItem from "./ListItem";

interface VerticalListProps {
    readonly files: FilezFile[];
    readonly g: G;
}

interface VerticalListState {}

const outerElementType = forwardRef<HTMLDivElement, any>((props, ref) => {
    return (
        <div
            ref={ref}
            onWheel={e => {
                e.currentTarget.scrollBy(e.deltaY, 0);
            }}
            {...props}
        ></div>
    );
});

export default class VerticalList extends Component<VerticalListProps, VerticalListState> {
    render = () => {
        const itemCount = this.props.g.selectedGroup?.itemCount;
        if (itemCount === undefined) {
            return <div className="ListView"></div>;
        }
        return (
            <div className="VerticalList">
                <AutoSizer>
                    {({ height, width }) => (
                        <InfiniteLoader
                            isItemLoaded={index => this.props.files[index] !== undefined}
                            itemCount={itemCount}
                            loadMoreItems={this.props.g.fn.loadMoreFiles}
                            threshold={20}
                            minimumBatchSize={40}
                        >
                            {({ onItemsRendered, ref }) => (
                                <List
                                    outerElementType={outerElementType}
                                    itemSize={height}
                                    layout="horizontal"
                                    height={height}
                                    itemCount={itemCount}
                                    width={width}
                                    ref={ref}
                                    onItemsRendered={onItemsRendered}
                                >
                                    {({
                                        index,
                                        style
                                    }: {
                                        index: number;
                                        style: CSSProperties;
                                    }) => {
                                        const file = this.props.files[index];
                                        if (file === undefined) {
                                            return null;
                                        }
                                        return (
                                            <ListItem
                                                g={this.props.g}
                                                style={style}
                                                key={file._id}
                                                file={file}
                                            />
                                        );
                                    }}
                                </List>
                            )}
                        </InfiniteLoader>
                    )}
                </AutoSizer>
            </div>
        );
    };
}
