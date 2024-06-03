import { Component } from "preact";
import { G } from "../../../../../../App";
import { FileView } from "../../../../../../types";
import File from "../../../../../file/File";
import "./Single.scss";

interface SingleProps {
    readonly g: G;
}
interface SingleState {}
export default class Single extends Component<SingleProps, SingleState> {
    render = () => {
        const f = this.props.g.selectedFile;
        if (f === null) return <div className="Single"></div>;
        return (
            <div className="Single">
                <File g={this.props.g} file={f} viewType={FileView.Single}></File>
            </div>
        );
    };
}
