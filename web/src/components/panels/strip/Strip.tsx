import { Component } from "preact";
import { G } from "../../../App";
import { ReducedFilezFile } from "../../../types";
import { DraggableTarget } from "../../drag/DraggableTarget";
import "./Strip.scss";
import VerticalList from "./VerticalList";

interface StripProps {
    readonly files: ReducedFilezFile[];
    readonly g: G;
}

interface StripState {}

export default class Strip extends Component<StripProps, StripState> {
    render = () => {
        return (
            <div id="file-strip-panel" className="vertical-panel panel">
                <DraggableTarget acceptType="file">
                    <VerticalList g={this.props.g} files={this.props.files}></VerticalList>
                </DraggableTarget>
            </div>
        );
    };
}
