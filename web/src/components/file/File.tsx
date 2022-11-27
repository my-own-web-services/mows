import { Component } from "preact";
import { G } from "../../App";
import { FileView, FilezFile } from "../../types";
import { displayBytes } from "../../utils/bytes";
import { DraggableItem } from "../drag/DraggableItem";
import "./File.scss";
import Image from "./Image";

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
        const n = f.name.substring(0, 10);
        return (
            <div
                onDblClick={() => {
                    this.props.g.fn.fileDoubleClick(f, vt);
                }}
                className={`File${this.props.isSelected ? " selected" : ""}`}
            >
                <DraggableItem type="file" id={f._key}>
                    {(() => {
                        if (vt === FileView.Strip || vt === FileView.Grid) {
                            return (
                                <div
                                    className={`hover ${this.props.isSelected ? " selected" : ""}`}
                                >
                                    <div style={{ height: "20px" }}>{n}</div>
                                    <div style={{ height: "calc(100% - 20px)" }}>
                                        <Image file={this.props.file}></Image>
                                    </div>
                                </div>
                            );
                        } else if (vt === FileView.List) {
                            return (
                                <div
                                    className={`hover ${this.props.isSelected ? " selected" : ""}`}
                                >
                                    <div style={{ width: "150px", float: "left" }}>{n}</div>
                                    <div style={{ width: "200px", float: "left" }}>
                                        {f.mimeType}
                                    </div>
                                    <div style={{ width: "100px", float: "left" }}>
                                        {displayBytes(f.size)}
                                    </div>
                                </div>
                            );
                        } else if (vt === FileView.Group) {
                            return <div>{n}</div>;
                        } else if (vt === FileView.Single) {
                            return <Image file={this.props.file}></Image>;
                        } else if (vt === FileView.Sheets) {
                            return <div>{n}</div>;
                        } else {
                            return <div>Unknown view</div>;
                        }
                    })()}
                </DraggableItem>
            </div>
        );
    };
}
