import { Component } from "preact";
import Slider from "rsuite/Slider";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";

import "./GridView.scss";
import { FilezFile } from "../../../../../../types";
import { CSSProperties } from "preact/compat";
import GridRow from "./GridRow";
import { G } from "../../../../../../App";
import { DraggableTarget } from "../../../../../drag/DraggableTarget";
import Center, { View } from "../../../Center";
import InfiniteLoader from "react-window-infinite-loader";

interface GridViewProps {
    readonly files: FilezFile[];
    readonly g: G;
    readonly columns: number;
    readonly scrollPos: number;
    readonly updateScrollPos: Center["updateScrollPos"];
}

interface GridViewState {}

export default class GridView extends Component<GridViewProps, GridViewState> {
    constructor(props: GridViewProps) {
        super(props);
        this.state = {
            columns: 10
        };
    }
    render = () => {
        const c = this.props.g.selectedGroup?.itemCount;
        if (c === undefined) {
            return <div className="GridView"></div>;
        }
        const rowCount = Math.ceil(c / this.props.columns);

        return (
            <div className="GridView">
                <div className="toolbar">
                    <span title="Columns" className="sizeSlider">
                        <div title="Columns">{this.props.columns}</div>
                        <Slider
                            title="Columns"
                            tooltip={false}
                            style={{ width: 100, margin: 12 }}
                            value={this.props.columns}
                            min={1}
                            max={10}
                            onChange={(value: number) => {
                                this.props.g.fn.setGridViewColumns(value);
                            }}
                        />
                    </span>
                </div>
                <div className="Grid">
                    <DraggableTarget acceptType="file">
                        <AutoSizer>
                            {({ height, width }) => (
                                <InfiniteLoader
                                    isItemLoaded={index =>
                                        this.props.files[index * this.props.columns] !== undefined
                                    }
                                    itemCount={rowCount}
                                    loadMoreItems={(startIndex, stopIndex) => {
                                        return this.props.g.fn.loadMoreFiles(
                                            startIndex * this.props.columns,
                                            stopIndex * this.props.columns -
                                                startIndex * this.props.columns +
                                                this.props.columns
                                        );
                                    }}
                                    threshold={10}
                                    minimumBatchSize={10}
                                >
                                    {({ onItemsRendered, ref }) => (
                                        <FixedSizeList
                                            overscanCount={5}
                                            itemSize={width / this.props.columns}
                                            height={height}
                                            itemCount={rowCount}
                                            ref={ref}
                                            onItemsRendered={onItemsRendered}
                                            width={width}
                                            initialScrollOffset={this.props.scrollPos}
                                            onScroll={({ scrollOffset }) => {
                                                this.props.updateScrollPos(scrollOffset, View.Grid);
                                            }}
                                        >
                                            {({
                                                index,
                                                style
                                            }: {
                                                index: number;
                                                style: CSSProperties;
                                            }) => {
                                                const startIndex = index * this.props.columns;
                                                const endIndex = startIndex + this.props.columns;
                                                const files = this.props.files.slice(
                                                    startIndex,
                                                    endIndex
                                                );

                                                return (
                                                    <GridRow
                                                        g={this.props.g}
                                                        itemWidth={width / this.props.columns}
                                                        rowIndex={index}
                                                        style={style}
                                                        key={"GridRow" + index}
                                                        files={files}
                                                        columns={this.props.columns}
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
