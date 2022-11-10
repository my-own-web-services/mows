import { Component } from "preact";
import "./ListView.scss";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import { CSSProperties } from "preact/compat";
import { FilezFile } from "../../../../../../types";
import ListRow from "./ListRow";

interface ListProps {
    readonly files: FilezFile[];
}
interface ListState {}
export default class List extends Component<ListProps, ListState> {
    render = () => {
        return (
            <div className="ListView">
                <div className="toolbar"></div>
                <div className="List">
                    <AutoSizer>
                        {({ height, width }) => (
                            <FixedSizeList
                                itemSize={20}
                                height={height}
                                itemCount={this.props.files.length}
                                width={width}
                            >
                                {({ index, style }: { index: number; style: CSSProperties }) => {
                                    const file = this.props.files[index];

                                    return (
                                        <ListRow
                                            style={style}
                                            key={"ListRow" + index} //TODO: fix this
                                            file={file}
                                        />
                                    );
                                }}
                            </FixedSizeList>
                        )}
                    </AutoSizer>
                </div>
            </div>
        );
    };
}
