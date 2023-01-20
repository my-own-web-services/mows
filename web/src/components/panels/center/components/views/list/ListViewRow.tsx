import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { G } from "../../../../../../App";
import { FileView, FilezFile } from "../../../../../../types";
import GroupOrFileItem from "../../../../../groupOrFile/GroupOrFileItem";
import "./ListViewRow.scss";

interface ListViewRowProps {
    readonly style: CSSProperties;
    readonly file: FilezFile;
    readonly g: G;
}
interface ListViewRowState {}
export default class ListViewRow extends Component<ListViewRowProps, ListViewRowState> {
    render = () => {
        if (!this.props.file) {
            return <div>Loading...</div>;
        }
        return (
            <div style={{ ...this.props.style }} className="ListViewRow">
                <GroupOrFileItem
                    viewType={FileView.List}
                    g={this.props.g}
                    file={this.props.file}
                ></GroupOrFileItem>
            </div>
        );
    };
}
