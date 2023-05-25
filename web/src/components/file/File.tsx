import { Component } from "preact";
import { G } from "../../App";
import { FileView } from "../../types";
import { displayBytes } from "../../utils/bytes";
import { DraggableItem } from "../drag/DraggableItem";
import FileIcon from "../small/FileIcon";
import Audio from "./Audio";
import "./File.scss";
import Image from "./Image";
import Text from "./Text";
import Video from "./Video";
import VideoPreview from "./VideoPreview";
import { FilezFile } from "@firstdorsal/filez-frontend";

interface FileProps {
    readonly file: FilezFile;
    readonly g: G;
    readonly isSelected?: boolean;
    readonly viewType: FileView;
    readonly itemWidth?: number;
}
interface FileState {}
export default class File extends Component<FileProps, FileState> {
    render = () => {
        const f = this.props.file;
        const vt = this.props.viewType;
        return (
            <div
                onDblClick={e => {
                    this.props.g.fn.fileDoubleClick(f, vt);
                }}
                className={`File${this.props.isSelected ? " selected" : ""} File${vt}`}
            >
                {(() => {
                    if (vt === FileView.Strip || vt === FileView.Grid) {
                        return (
                            <DraggableItem type="file" id={f._id}>
                                <div
                                    className={`hover ${this.props.isSelected ? " selected" : ""}`}
                                >
                                    <div className="fileName" style={{ height: "20px" }}>
                                        {f.name}
                                    </div>
                                    <div style={{ height: "calc(100% - 20px)" }}>
                                        {f.mimeType.startsWith("image/") ? (
                                            <Image
                                                itemWidth={this.props.itemWidth}
                                                g={this.props.g}
                                                file={this.props.file}
                                            />
                                        ) : null}
                                        {f.mimeType.startsWith("video/") ? (
                                            <VideoPreview g={this.props.g} file={this.props.file} />
                                        ) : null}
                                        {f.mimeType.startsWith("audio/") ? (
                                            <Image
                                                itemWidth={this.props.itemWidth}
                                                g={this.props.g}
                                                file={this.props.file}
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            </DraggableItem>
                        );
                    } else if (vt === FileView.List) {
                        return (
                            <DraggableItem type="file" id={f._id}>
                                <div
                                    className={`hover ${this.props.isSelected ? " selected" : ""}`}
                                >
                                    <div style={{ float: "left", width: "25px" }}>
                                        <FileIcon file={this.props.file} />
                                    </div>
                                    <div
                                        className="fileName"
                                        style={{ width: "350px", float: "left" }}
                                    >
                                        {f.name}
                                    </div>
                                    <div style={{ width: "200px", float: "left" }}>
                                        {f.mimeType}
                                    </div>
                                    <div style={{ width: "100px", float: "left" }}>
                                        {displayBytes(f.size)}
                                    </div>
                                </div>
                            </DraggableItem>
                        );
                    } else if (vt === FileView.Group) {
                        return <div className="fileName">{f.name}</div>;
                    } else if (vt === FileView.Single) {
                        return (() => {
                            if (f.mimeType.startsWith("image/")) {
                                return (
                                    <Image
                                        itemWidth={this.props.itemWidth}
                                        g={this.props.g}
                                        file={f}
                                    />
                                );
                            } else if (f.mimeType.startsWith("audio/")) {
                                return <Audio g={this.props.g} file={f} />;
                            } else if (f.mimeType.startsWith("video/")) {
                                return <Video g={this.props.g} file={f} />;
                            } else if (f.mimeType.startsWith("text/")) {
                                return <Text g={this.props.g} file={f} />;
                            }
                        })();
                    } else if (vt === FileView.Sheets) {
                        return <div className="fileName">{f.name}</div>;
                    } else {
                        return <div>Unknown view</div>;
                    }
                })()}
            </div>
        );
    };
}
