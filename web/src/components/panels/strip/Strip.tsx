import { Component } from "preact";
import { G } from "../../../App";
import { DraggableTarget } from "../../drag/DraggableTarget";
import "./Strip.scss";
import VerticalList from "./VerticalList";
import { FilezFile } from "@firstdorsal/filez-frontend";

interface StripProps {
    readonly files: FilezFile[];
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
