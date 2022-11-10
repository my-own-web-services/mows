import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { FilezFile } from "../../../../../../types";
import "./ListRow.scss";

interface ListRowProps {
    readonly style: CSSProperties;
    readonly file: FilezFile;
}
interface ListRowState {}
export default class ListRow extends Component<ListRowProps, ListRowState> {
    render = () => {
        return (
            <div style={{ ...this.props.style }} className="ListRow">
                {this.props.file.name}
            </div>
        );
    };
}
