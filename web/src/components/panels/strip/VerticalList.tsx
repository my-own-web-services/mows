import { Component } from "preact";
import { CSSProperties, forwardRef } from "preact/compat";
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
