import { Component, createRef } from "preact";
import { G } from "../../App";
import { FilezFile } from "../../types";
import "./Video.scss";
interface VideoProps {
    readonly g: G;
    readonly file: FilezFile;
}
interface VideoState {}
export default class Video extends Component<VideoProps, VideoState> {
    private videoRef = createRef<HTMLVideoElement>();
    private player: any;

    componentDidUpdate = async (newProps: VideoProps) => {
        if (this.videoRef.current && this.props.file._id !== newProps.file._id) {
            this.videoRef.current.load();
            // @ts-ignore
            if (!dashjs) {
                // @ts-ignore
                await import("/node_modules/dashjs/dist/dash.all.min.js");

                await import("/node_modules/dashjs/contrib/akamai/controlbar/controlbar.css");
            }

            if (!this.player) {
                // @ts-ignore
                this.player = dashjs.MediaPlayer().create();
                this.player.initialize(
                    this.videoRef.current,
                    `${this.props.g.uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}/videoProcessor/manifest.mpd`,
                    true
                );
            }
            this.player.attachSource(
                `${this.props.g.uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}/videoProcessor/manifest.mpd`
            );
        }
    };

    componentDidMount = async () => {
        // @ts-ignore
        await import("/node_modules/dashjs/dist/dash.all.min.js");

        await import("/node_modules/dashjs/contrib/akamai/controlbar/controlbar.css");

        if (this.videoRef.current) {
            // @ts-ignore
            this.player = dashjs.MediaPlayer().create();

            this.player.initialize(
                this.videoRef.current,
                `${this.props.g.uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}/videoProcessor/manifest.mpd`,

                true
            );

            // @ts-ignore
            const controlbar = ControlBar(this.player);
            controlbar.initialize();
        }
    };

    render = () => {
        return (
            <div className="Video">
                <div class="dash-video-player ">
                    <div class="videoContainer" id="videoContainer">
                        <video data-dashjs-player ref={this.videoRef}></video>
                        <div id="videoController" class="video-controller unselectable">
                            <div id="playPauseBtn" class="btn-play-pause" title="Play/Pause">
                                <span id="iconPlayPause" class="icon-play"></span>
                            </div>
                            <span id="videoTime" class="time-display">
                                00:00:00
                            </span>
                            <div
                                id="fullscreenBtn"
                                class="btn-fullscreen control-icon-layout"
                                title="Fullscreen"
                            >
                                <span class="icon-fullscreen-enter"></span>
                            </div>
                            <div
                                id="bitrateListBtn"
                                class="control-icon-layout"
                                title="Bitrate List"
                            >
                                <span class="icon-bitrate"></span>
                            </div>
                            <input
                                type="range"
                                id="volumebar"
                                class="volumebar"
                                value="1"
                                min="0"
                                max="1"
                                step=".01"
                            />
                            <div id="muteBtn" class="btn-mute control-icon-layout" title="Mute">
                                <span id="iconMute" class="icon-mute-off"></span>
                            </div>
                            <div id="trackSwitchBtn" class="control-icon-layout" title="A/V Tracks">
                                <span class="icon-tracks"></span>
                            </div>
                            <div
                                id="captionBtn"
                                class="btn-caption control-icon-layout"
                                title="Closed Caption"
                            >
                                <span class="icon-caption"></span>
                            </div>
                            <span id="videoDuration" class="duration-display">
                                00:00:00
                            </span>
                            <div class="seekContainer">
                                <div id="seekbar" class="seekbar seekbar-complete">
                                    <div id="seekbar-buffer" class="seekbar seekbar-buffer"></div>
                                    <div id="seekbar-play" class="seekbar seekbar-play"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
}
