import { Component } from "preact";
import "./Right.scss";

interface RightProps {}
interface RightState {}
export default class Right extends Component<RightProps, RightState> {
    render = () => {
        return <div id="main-panel-right" className="horizontal-panel panel"></div>;
    };
}
