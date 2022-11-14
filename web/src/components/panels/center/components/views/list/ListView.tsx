import { Component } from "preact";
import "./ListView.scss";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import { CSSProperties } from "preact/compat";
import { FilezFile } from "../../../../../../types";
import ListViewRow from "./ListViewRow";
import { G } from "../../../../../../App";
import { DraggableTarget } from "../../../../../drag/DraggableTarget";

interface ListProps {
    readonly files: FilezFile[];
    readonly g: G;
}
interface ListState {}
export default class List extends Component<ListProps, ListState> {
    render = () => {
        return (
            <div className="ListView">
                <div className="toolbar"></div>
                <div className="List">
                    <DraggableTarget acceptType="file">
                        <AutoSizer>
                            {({ height, width }) => (
                                <FixedSizeList
                                    itemSize={20}
                                    height={height}
                                    itemCount={this.props.files.length}
                                    width={width}
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
                        </AutoSizer>
                    </DraggableTarget>
                </div>
            </div>
        );
    };
}
