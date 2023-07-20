import type dashjs from "dashjs";
import type { MediaPlayerClass } from "dashjs";
import { FilezFile } from "@firstdorsal/filez-client";
import { Component, createRef } from "react";
import { UiConfig } from "../../FilezProvider";
interface VideoProps {
    readonly file: FilezFile;
    readonly uiConfig: UiConfig;
}
interface VideoState {}

export default class Video extends Component<VideoProps, VideoState> {
    private videoRef = createRef<HTMLVideoElement>();
    private player!: MediaPlayerClass;
    useDash = false;

    componentDidUpdate = async (newProps: VideoProps) => {
        if (this.videoRef.current && this.props.file._id !== newProps.file._id) {
            if (this.useDash) {
                await this.importDash();

                this.videoRef.current.load();

                this.player.attachSource(
                    `${this.props.uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}/video/manifest.mpd?c`
                );
            }
        }
    };

    hasConvertedVersion = () => {
        const f = this.props.file;
        return f.appData.video?.status === "finished" && typeof f.appData.video?.error !== "string";
    };

    componentDidMount = async () => {
        const hasConvertedVersion = this.hasConvertedVersion();

        if (hasConvertedVersion) {
            this.useDash = true;
        } else {
            this.useDash = false;
        }

        if (this.useDash) {
            this.importDash();
            if (this.videoRef.current) {
                this.initDashPlayer();
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
                `${this.props.uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}/video/manifest.mpd?c`,
                true
            );
        }
    };

    render = () => {
        const f = this.props.file;
        const hasConvertedVersion = this.hasConvertedVersion();

        return (
            <div className="Video" style={{ width: "100%" }}>
                <div className="dash-video-player" style={{ width: "100%" }}>
                    <div className="videoContainer" id="videoContainer" style={{ width: "100%" }}>
                        <video
                            data-dashjs-player
                            ref={this.videoRef}
                            controls
                            style={{ width: "100%" }}
                        >
                            {!hasConvertedVersion && (
                                <source
                                    src={`${this.props.uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}`}
                                    type={f.mimeType}
                                />
                            )}
                        </video>
                    </div>
                </div>
            </div>
        );
    };
}
