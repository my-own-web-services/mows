import { Component } from "preact";
import { DraggableTarget } from "../../drag/DraggableTarget";
import "./Left.scss";

interface LeftProps {}
interface LeftState {}
export default class Left extends Component<LeftProps, LeftState> {
    render = () => {
        return (
            <div id="main-panel-left" className="horizontal-panel panel">
                <DraggableTarget></DraggableTarget>
            </div>
        );
    };
}
