import { Component } from "preact";
import { G } from "../../App";
import { FileView, ReducedFilezFile } from "../../types";
import { displayBytes } from "../../utils/bytes";
import { DraggableItem } from "../drag/DraggableItem";
import Audio from "./Audio";
import "./File.scss";
import Image from "./Image";

interface FileProps {
    readonly file: ReducedFilezFile;
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
            <div
                onDblClick={() => {
                    this.props.g.fn.fileDoubleClick(f, vt);
                }}
                className={`File${this.props.isSelected ? " selected" : ""}`}
            >
                <DraggableItem type="file" id={f._id}>
                    {(() => {
                        if (vt === FileView.Strip || vt === FileView.Grid) {
                            return (
                                <div
                                    className={`hover ${this.props.isSelected ? " selected" : ""}`}
                                >
                                    <div style={{ height: "20px" }}>{f.name.substring(0, 10)}</div>
                                    <div style={{ height: "calc(100% - 20px)" }}>
                                        {f.mimeType.startsWith("image/") ? (
                                            <Image file={this.props.file}></Image>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        } else if (vt === FileView.List) {
                            return (
                                <div
                                    className={`hover ${this.props.isSelected ? " selected" : ""}`}
                                >
                                    <div style={{ width: "350px", float: "left" }}>
                                        {f.name.substring(0, 40)}
                                    </div>
                                    <div style={{ width: "200px", float: "left" }}>
                                        {f.mimeType}
                                    </div>
                                    <div style={{ width: "100px", float: "left" }}>
                                        {displayBytes(f.size)}
                                    </div>
                                </div>
                            );
                        } else if (vt === FileView.Group) {
                            return <div>{f.name.substring(0, 10)}</div>;
                        } else if (vt === FileView.Single) {
                            return (() => {
                                if (f.mimeType.startsWith("image/")) {
                                    return <Image file={f}></Image>;
                                } else if (f.mimeType.startsWith("audio/")) {
                                    return <Audio file={f}></Audio>;
                                }
                            })();
                        } else if (vt === FileView.Sheets) {
                            return <div>{f.name.substring(0, 10)}</div>;
                        } else {
                            return <div>Unknown view</div>;
                        }
                    })()}
                </DraggableItem>
            </div>
        );
    };
}
