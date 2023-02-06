import { Component } from "preact";
import { G } from "../../App";
import { FilezFile } from "../../types";
import "./VideoPreview.scss";
interface VideoPreviewProps {
    readonly g: G;
    readonly file: FilezFile;
}
interface VideoPreviewState {}
export default class VideoPreview extends Component<VideoPreviewProps, VideoPreviewState> {
    render = () => {
        const f = this.props.file;

        if (f.appData.video?.status !== "finished" || typeof f.appData.video?.error === "string") {
            return;
        }
        return (
            <div className="VideoPreview">
                <img
                    draggable={false}
                    src={`${this.props.g.uiConfig.filezServerAddress}/api/get_file/${f._id}/video/t/1.webp?c`}
                />
            </div>
        );
    };
}
