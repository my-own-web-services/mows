import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { G } from "../../../../App";
import { FileGroup } from "../../../../types";
import GroupOrFileItem from "../../../groupOrFile/GroupOrFileItem";

interface GroupListRowProps {
    readonly style: CSSProperties;
    readonly group: FileGroup;
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
                <GroupOrFileItem group={this.props.group} g={this.props.g}></GroupOrFileItem>
            </div>
        );
    };
}
