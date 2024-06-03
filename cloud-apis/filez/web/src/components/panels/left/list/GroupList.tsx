import { Component } from "preact";
import "./GroupList.scss";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import { CSSProperties } from "preact/compat";
import GroupListRow from "./GroupListRow";
import { G } from "../../../../App";
import { VisualFileGroup } from "../../../../utils/convertFileGroups";

interface GroupListProps {
    readonly groups: VisualFileGroup[];
    readonly g: G;
}
interface GroupListState {}

export default class GroupList extends Component<GroupListProps, GroupListState> {
    render = () => {
        return (
            <div className="GroupList">
                <AutoSizer>
                    {({ height, width }: { height: number; width: number }) => (
                        <FixedSizeList
                            itemSize={20}
                            /* @ts-ignore */
                            height={height}
                            itemCount={this.props.groups.length}
                            /* @ts-ignore */
                            width={width}
                        >
                            {({ index, style }: { index: number; style: CSSProperties }) => {
                                const group = this.props.groups[index];

                                return (
                                    <GroupListRow
                                        g={this.props.g}
                                        style={style}
                                        key={"GroupListRow" + index}
                                        group={group}
                                    />
                                );
                            }}
                        </FixedSizeList>
                    )}
                </AutoSizer>
            </div>
        );
    };
}
