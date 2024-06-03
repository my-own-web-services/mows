import { Component } from "preact";
import { G } from "../../App";
import "./VideoPreview.scss";
import { FilezFile } from "@firstdorsal/filez-client";
interface VideoPreviewProps {
    readonly g: G;
    readonly file: FilezFile;
}
interface VideoPreviewState {}
export default class VideoPreview extends Component<VideoPreviewProps, VideoPreviewState> {
    render = () => {
        const f = this.props.file;

        return (
            <div className="VideoPreview">
                {(() => {
                    if (
                        f.appData.video?.status === "finished" &&
                        typeof f.appData.video?.error !== "string"
                    ) {
                        return (
                            <img
                                draggable={false}
                                src={`${this.props.g.uiConfig.filezServerAddress}/api/get_file/${f._id}/video/t/1.webp?c`}
                            />
                        );
                    } else if (
                        f.appData.image?.status === "finished" &&
                        typeof f.appData.image?.error !== "string"
                    ) {
                        return (
                            <img
                                draggable={false}
                                src={`${this.props.g.uiConfig.filezServerAddress}/api/get_file/${f._id}/image/500.avif?c`}
                            />
                        );
                    }
                })()}
            </div>
        );
    };
}
