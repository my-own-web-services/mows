import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { G } from "../../../../App";
import { VisualFileGroup } from "../../../../utils/convertFileGroups";
import GroupOrFileItem from "../../../groupOrFile/GroupOrFileItem";

interface GroupListRowProps {
    readonly style: CSSProperties;
    readonly group: VisualFileGroup;
    readonly g: G;
}

interface GroupListRowState {}
export default class GroupListRow extends Component<GroupListRowProps, GroupListRowState> {
    render = () => {
        return (
            <div
                style={{
                    ...this.props.style
                }}
                className="GroupListRow"
            >
                <GroupOrFileItem fileGroup={this.props.group} g={this.props.g}></GroupOrFileItem>
            </div>
        );
    };
}
