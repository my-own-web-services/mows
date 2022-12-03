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

interface GridViewProps {
    readonly files: FilezFile[];
    readonly g: G;
    readonly columns: number;
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
                                <FixedSizeList
                                    itemSize={width / this.props.columns}
                                    height={height}
                                    itemCount={Math.ceil(
                                        this.props.files.length / this.props.columns
                                    )}
                                    width={width}
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
                                        const files = this.props.files.slice(startIndex, endIndex);

                                        return (
                                            <GridRow
                                                g={this.props.g}
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
                        </AutoSizer>
                    </DraggableTarget>
                </div>
            </div>
        );
    };
}
