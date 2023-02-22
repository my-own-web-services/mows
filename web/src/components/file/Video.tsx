import { Component, createRef } from "preact";
import { G } from "../../App";
import { FilezFile } from "../../types";
import type dashjs from "dashjs";
import type { MediaPlayerClass } from "dashjs";
import "./Video.scss";
interface VideoProps {
    readonly g: G;
    readonly file: FilezFile;
}
interface VideoState {}

const useDash = true;

export default class Video extends Component<VideoProps, VideoState> {
    private videoRef = createRef<HTMLVideoElement>();
    private player!: MediaPlayerClass;

    componentDidUpdate = async (newProps: VideoProps) => {
        if (this.videoRef.current && this.props.file._id !== newProps.file._id) {
            if (useDash) {
                await this.importDash();

                this.videoRef.current.load();

                this.player.attachSource(
                    `${this.props.g.uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}/video/manifest.mpd?c`
                );
            }
        }
    };

    importDash = async () => {
        // @ts-ignore
        if (!window.dashjs) {
            // @ts-ignore
            await import("/node_modules/dashjs/dist/dash.mediaplayer.debug.js");
        }
    };

    initDashPlayer = async () => {
        await this.importDash();
        if (!this.player && this.videoRef.current) {
            // @ts-ignore
            this.player = dashjs.MediaPlayer().create();
            this.player.setXHRWithCredentialsForType("GET", true);
            this.player.setXHRWithCredentialsForType("MPD", true);
            this.player.setXHRWithCredentialsForType("MediaSegment", true);
            this.player.setXHRWithCredentialsForType("InitializationSegment", true);
            this.player.setXHRWithCredentialsForType("IndexSegment", true);
            this.player.setXHRWithCredentialsForType("other", true);

            this.player.initialize(
                this.videoRef.current,
                `${this.props.g.uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}/video/manifest.mpd?c`,
                true
            );
        }
    };

    componentDidMount = async () => {
        if (useDash) {
            this.importDash();
            if (this.videoRef.current) {
                this.initDashPlayer();
            }
        }
    };

    render = () => {
        const f = this.props.file;
        return (
            <div className="Video">
                <div class="dash-video-player ">
                    <div class="videoContainer" id="videoContainer">
                        <video data-dashjs-player ref={this.videoRef} controls>
                            <source
                                src={`${this.props.g.uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}`}
                                type={f.mimeType}
                            />
                        </video>
                    </div>
                </div>
            </div>
        );
    };
}
