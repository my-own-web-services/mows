import { Component } from "preact";
import "./ListView.scss";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import { CSSProperties } from "preact/compat";
import { FilezFile } from "../../../../../../types";
import ListViewRow from "./ListViewRow";
import { G } from "../../../../../../App";
import { DraggableTarget } from "../../../../../drag/DraggableTarget";
import Center, { View } from "../../../Center";
import InfiniteLoader from "react-window-infinite-loader";

interface ListProps {
    readonly files: FilezFile[];
    readonly g: G;
    readonly scrollPos: number;
    readonly updateScrollPos: Center["updateScrollPos"];
}
interface ListState {}
export default class List extends Component<ListProps, ListState> {
    render = () => {
        const itemCount = this.props.g.selectedGroup?.itemCount;
        if (itemCount === undefined) {
            return <div className="ListView"></div>;
        }
        return (
            <div className="ListView">
                <div className="toolbar"></div>
                <div className="List">
                    <DraggableTarget acceptType="file">
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
                                        <FixedSizeList
                                            overscanCount={20}
                                            itemSize={20}
                                            height={height}
                                            itemCount={itemCount}
                                            width={width}
                                            ref={ref}
                                            onItemsRendered={onItemsRendered}
                                            initialScrollOffset={this.props.scrollPos}
                                            onScroll={({ scrollOffset }) => {
                                                this.props.updateScrollPos(scrollOffset, View.List);
                                            }}
                                        >
                                            {({
                                                index,
                                                style
                                            }: {
                                                index: number;
                                                style: CSSProperties;
                                            }) => {
                                                const file = this.props.files[index];

                                                return (
                                                    <ListViewRow
                                                        g={this.props.g}
                                                        style={style}
                                                        key={"ListViewRow" + index}
                                                        file={file}
                                                    />
                                                );
                                            }}
                                        </FixedSizeList>
                                    )}
                                </InfiniteLoader>
                            )}
                        </AutoSizer>
                    </DraggableTarget>
                </div>
            </div>
        );
    };
}
