import { Component, createRef } from "preact";
import { FilezFile } from "../../types";
import "./Video.scss";

interface VideoProps {
    readonly file: FilezFile;
}
interface VideoState {}
export default class Video extends Component<VideoProps, VideoState> {
    private videoRef = createRef<HTMLVideoElement>();

    componentDidUpdate = (newProps: VideoProps) => {
        if (this.videoRef.current && this.props.file._id !== newProps.file._id) {
            this.videoRef.current.load();
        }
    };

    componentDidMount = async () => {
        // @ts-ignore
        await import("/node_modules/dashjs/dist/dash.all.debug.js");

        if (this.videoRef.current) {
            // @ts-ignore
            const player = dashjs.MediaPlayer().create();
            player.updateSettings({
                debug: {
                    logLevel: dashjs.Debug.LOG_LEVEL_DEBUG // turns off console logging
                }
            });
            player.initialize(
                this.videoRef.current,
                `/api/get_file/${this.props.file._id}/videoProcessor/manifest.mpd`,

                true
            );
        }
    };

    render = () => {
        return (
            <div className="Video">
                <video data-dashjs-player ref={this.videoRef} controls></video>
            </div>
        );
    };
}
