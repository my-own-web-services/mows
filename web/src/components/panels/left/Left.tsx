import { Component } from "preact";
import { G } from "../../../App";
import { FileGroup } from "../../../types";
import "./Left.scss";
import GroupList from "./list/GroupList";

interface LeftProps {
    readonly g: G;
    readonly groups: FileGroup[];
}
interface LeftState {}
export default class Left extends Component<LeftProps, LeftState> {
    render = () => {
        return (
            <div id="main-panel-left" className="Left horizontal-panel panel">
                <GroupList g={this.props.g} groups={this.props.groups}></GroupList>
            </div>
        );
    };
}
