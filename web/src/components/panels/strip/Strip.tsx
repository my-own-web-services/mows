import { Component } from "preact";
import { G } from "../../../App";
import { FilezFile } from "../../../types";
import "./Strip.scss";
import VerticalList from "./VerticalList";

interface StripProps {
    readonly files: FilezFile[];
    readonly g: G;
}

interface StripState {}

export default class Strip extends Component<StripProps, StripState> {
    render = () => {
        return (
            <div id="file-strip-panel" className="vertical-panel panel">
                <VerticalList g={this.props.g} files={this.props.files}></VerticalList>
            </div>
        );
    };
}
