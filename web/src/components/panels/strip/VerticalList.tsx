import { Component } from "preact";
import { CSSProperties, forwardRef } from "preact/compat";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList as List } from "react-window";
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
        return (
            <div className="VerticalList">
                <AutoSizer>
                    {({ height, width }) => (
                        <List
                            outerElementType={outerElementType}
                            itemSize={height}
                            layout="horizontal"
                            height={height}
                            itemCount={this.props.files.length}
                            width={width}
                        >
                            {({ index, style }: { index: number; style: CSSProperties }) => {
                                const file = this.props.files[index];
                                return (
                                    <ListItem
                                        g={this.props.g}
                                        style={style}
                                        key={file.fileId}
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
