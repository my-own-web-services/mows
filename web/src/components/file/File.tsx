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
        const f = this.props.file;
        const vt = this.props.viewType;
        return (
            <div className={`File${this.props.isSelected ? " selected" : ""}`}>
                <DraggableItem type="file" id={f.fileId}>
                    {(() => {
                        if (vt === FileView.Strip) {
                            return <div>{f.fileId}</div>;
                        } else if (vt === FileView.Grid) {
                            return <div>{f.fileId}</div>;
                        } else if (vt === FileView.List) {
                            return <div>{f.fileId}</div>;
                        } else if (vt === FileView.Group) {
                            return <div>{f.fileId}</div>;
                        } else if (vt === FileView.Single) {
                            return <div>{f.fileId}</div>;
                        } else if (vt === FileView.Sheets) {
                            return <div>{f.fileId}</div>;
                        } else {
                            return <div>Unknown view</div>;
                        }
                    })()}
                </DraggableItem>
            </div>
        );
    };
}
