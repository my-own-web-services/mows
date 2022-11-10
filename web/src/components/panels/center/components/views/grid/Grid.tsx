import { Component } from "preact";
import Slider from "rsuite/Slider";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList as List } from "react-window";

import "./Grid.scss";
import "rsuite/Slider/styles/index.less";
import "rsuite/Tooltip/styles/index.less";
import { FilezFile } from "../../../../../../types";
import { CSSProperties } from "preact/compat";
import GridRow from "./GridRow";
interface GridProps {
    files: FilezFile[];
}
interface GridState {
    columns: number;
}
export default class Grid extends Component<GridProps, GridState> {
    constructor(props: GridProps) {
        super(props);
        this.state = {
            columns: 10
        };
    }
    render = () => {
        return (
            <div className="Grid">
                <div className="toolbar">
                    <span title="Columns" className="sizeSlider">
                        <div title="Columns">{this.state.columns}</div>
                        <Slider
                            title="Columns"
                            tooltip={false}
                            style={{ width: 100, margin: 12 }}
                            value={this.state.columns}
                            min={1}
                            max={20}
                            onChange={(value: number) => {
                                this.setState({ columns: value });
                            }}
                        />
                    </span>
                </div>
                <div className="grid">
                    <AutoSizer>
                        {({ height, width }) => (
                            <List
                                itemSize={width / this.state.columns}
                                height={height}
                                itemCount={Math.ceil(this.props.files.length / this.state.columns)}
                                width={width}
                            >
                                {({ index, style }: { index: number; style: CSSProperties }) => {
                                    const startIndex = index * this.state.columns;
                                    const endIndex = startIndex + this.state.columns;
                                    const files = this.props.files.slice(startIndex, endIndex);

                                    return (
                                        <GridRow
                                            style={style}
                                            key={index} //TODO: fix this
                                            files={files}
                                            columns={this.state.columns}
                                        />
                                    );
                                }}
                            </List>
                        )}
                    </AutoSizer>
                </div>
            </div>
        );
    };
}
