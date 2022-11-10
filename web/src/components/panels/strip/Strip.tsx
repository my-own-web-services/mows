import { Component } from "preact";
import { FilezFile } from "../../../types";
import "./Strip.scss";
import VerticalList from "./VerticalList";

interface StripProps {
    readonly files: FilezFile[];
}

interface StripState {}

export default class Strip extends Component<StripProps, StripState> {
    render = () => {
        return (
            <div id="file-strip-panel" className="vertical-panel panel">
                <VerticalList files={this.props.files}></VerticalList>
            </div>
        );
    };
}
