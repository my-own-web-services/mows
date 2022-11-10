import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList as List } from "react-window";
import { FilezFile } from "../../../types";
import ListItem from "./ListItem";

interface VerticalListProps {
    readonly files: FilezFile[];
}

interface VerticalListState {}

export default class VerticalList extends Component<VerticalListProps, VerticalListState> {
    render = () => {
        return (
            <div className="VerticalList">
                <AutoSizer>
                    {({ height, width }) => (
                        <List
                            itemSize={height}
                            direction="horizontal"
                            height={height}
                            itemCount={this.props.files.length}
                            width={width}
                        >
                            {({ index, style }: { index: number; style: CSSProperties }) => {
                                const file = this.props.files[index];
                                return (
                                    <ListItem
                                        style={style}
                                        key={"strip-" + file.fileId} //TODO: fix this
                                        file={file}
                                    />
                                );
                            }}
                        </List>
                    )}
                </AutoSizer>
            </div>
        );
    };
}
