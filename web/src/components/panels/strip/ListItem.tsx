import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { G } from "../../../App";
import { FileView, FilezFile } from "../../../types";
import GroupOrFileItem from "../../groupOrFile/GroupOrFileItem";

interface ListItemProps {
    readonly style: CSSProperties;
    readonly file: FilezFile;
    readonly g: G;
}
interface ListItemState {}
export default class ListItem extends Component<ListItemProps, ListItemState> {
    render = () => {
        return (
            <div style={{ ...this.props.style }} className="ListItem">
                <GroupOrFileItem
                    viewType={FileView.Strip}
                    file={this.props.file}
                    g={this.props.g}
                ></GroupOrFileItem>
            </div>
        );
    };
}
