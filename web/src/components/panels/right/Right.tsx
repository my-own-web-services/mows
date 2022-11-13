import { Component } from "preact";
import { G } from "../../../App";
import "./Right.scss";

interface RightProps {
    readonly g: G;
}
interface RightState {}
export default class Right extends Component<RightProps, RightState> {
    render = () => {
        return <div id="main-panel-right" className="horizontal-panel panel"></div>;
    };
}
