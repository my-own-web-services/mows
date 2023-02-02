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

        if (f.appData.video === undefined) return;
        return (
            <div className="VideoPreview">
                <img
                    src={`${this.props.g.uiConfig.filezServerAddress}/api/get_file/${f._id}/videoProcessor/t/1.webp`}
                />
            </div>
        );
    };
}
