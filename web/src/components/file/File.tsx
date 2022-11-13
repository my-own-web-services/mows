import { Component } from "preact";
import { G } from "../../App";
import { FileView, FilezFile } from "../../types";
import { DraggableItem } from "../drag/DraggableItem";
import "./File.scss";

interface FileProps {
    readonly file: FilezFile;
    readonly g: G;
    readonly isSelected?: boolean;
    readonly viewType: FileView;
}
interface FileState {}
export default class File extends Component<FileProps, FileState> {
    render = () => {
        return (
            <div className={`File${this.props.isSelected ? " selected" : ""}`}>
                {(() => {
                    if (this.props.viewType === FileView.Strip) {
                        return <div>{this.props.file.fileId}</div>;
                    } else if (this.props.viewType === FileView.Grid) {
                        return <div>{this.props.file.fileId}</div>;
                    } else if (this.props.viewType === FileView.List) {
                        return <div>{this.props.file.fileId}</div>;
                    } else if (this.props.viewType === FileView.Group) {
                        return <div>{this.props.file.fileId}</div>;
                    } else if (this.props.viewType === FileView.Single) {
                        return <div>{this.props.file.fileId}</div>;
                    } else if (this.props.viewType === FileView.Sheets) {
                        return <div>{this.props.file.fileId}</div>;
                    } else {
                        return <div>Unknown view</div>;
                    }
                })()}
            </div>
        );
    };
}
