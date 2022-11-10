import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { FilezFile } from "../../../types";

interface ListItemProps {
    readonly style: CSSProperties;
    readonly file: FilezFile;
}
interface ListItemState {}
export default class ListItem extends Component<ListItemProps, ListItemState> {
    render = () => {
        return <div style={{ ...this.props.style }} className="ListItem"></div>;
    };
}
