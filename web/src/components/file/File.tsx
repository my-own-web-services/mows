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
        const n = f.name.substring(0, 10);
        return (
            <div
                onDblClick={() => {
                    this.props.g.fn.fileDoubleClick(f);
                }}
                className={`File${this.props.isSelected ? " selected" : ""}`}
            >
                <DraggableItem type="file" id={f._key}>
                    {(() => {
                        if (vt === FileView.Strip || vt === FileView.Grid) {
                            return (
                                <div style={{ height: "100%", width: "100%" }}>
                                    <div style={{ height: "20px" }}>{n}</div>
                                    <div style={{ height: "calc(100% - 20px)" }}>
                                        {f.mimeType.startsWith("image/") ? (
                                            <img loading={"lazy"} src={`/api/get_file/${f._key}`} />
                                        ) : null}
                                    </div>
                                </div>
                            );
                        } else if (vt === FileView.List) {
                            return <div>{n}</div>;
                        } else if (vt === FileView.Group) {
                            return <div>{n}</div>;
                        } else if (vt === FileView.Single) {
                            return <div>{n}</div>;
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
