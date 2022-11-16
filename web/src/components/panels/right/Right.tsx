import { Component } from "preact";
import { G } from "../../../App";
import { FilezFile } from "../../../types";
import "./Right.scss";

interface RightProps {
    readonly g: G;
    readonly files: FilezFile[];
}
interface RightState {}
export default class Right extends Component<RightProps, RightState> {
    render = () => {
        return (
            <div id="main-panel-right" className="horizontal-panel panel">
                {JSON.stringify(this.props.g.selectedFiles[0], null, 2)}
            </div>
        );
    };
}
