import type dashjs from "dashjs";
import type { MediaPlayerClass } from "dashjs";
import { Component, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FileViewerViewMode } from "../FileViewer";
import Image from "./Image";

interface VideoProps {
    readonly file: FilezFile;
    readonly viewMode?: FileViewerViewMode;
    readonly disableFallback?: boolean;
}
interface VideoState {}

export default class Video extends Component<VideoProps, VideoState> {
    private videoRef = createRef<HTMLVideoElement>();
    private player!: MediaPlayerClass;
    useDash = false;

    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    componentDidUpdate = async (newProps: VideoProps) => {
        if (
            this.videoRef.current &&
            this.props.file._id !== newProps.file._id
        ) {
            if (this.useDash) {
                await this.importDash();

                this.videoRef.current.load();

                const uiConfig = this.context?.uiConfig;
                if (!uiConfig) return;

                this.player.attachSource(
                    `${uiConfig.filezServerAddress}/api/file/get/${this.props.file._id}/video/manifest.mpd?c`
                );
            }
        }
    };

    hasConvertedVersion = () => {
        const f = this.props.file;
        return (
            f.app_data.video?.status === "finished" &&
            typeof f.app_data.video?.error !== "string"
        );
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
            this.player.setXHRWithCredentialsForType(
                "InitializationSegment",
                true
            );
            this.player.setXHRWithCredentialsForType("IndexSegment", true);
            this.player.setXHRWithCredentialsForType("other", true);
            const uiConfig = this.context?.uiConfig;
            if (!uiConfig) return;
            this.player.initialize(
                this.videoRef.current,
                `${uiConfig.filezServerAddress}/api/file/get/${this.props.file._id}/video/manifest.mpd?c`,
                false
            );
        }
    };

    render = () => {
        const f = this.props.file;
        const hasConvertedVersion = this.hasConvertedVersion();
        const uiConfig = this.context?.uiConfig;
        if (!uiConfig) return;

        return (
            <div className="Video" style={{ width: "100%" }}>
                {this.props.viewMode === FileViewerViewMode.Preview ? (
                    <Image
                        viewMode={this.props.viewMode}
                        file={this.props.file}
                    />
                ) : (
                    <div
                        className="dash-video-player"
                        style={{ width: "100%" }}
                    >
                        <div
                            className="videoContainer"
                            id="videoContainer"
                            style={{ width: "100%" }}
                        >
                            <video
                                data-dashjs-player
                                ref={this.videoRef}
                                controls
                                style={{ width: "100%" }}
                            >
                                {!hasConvertedVersion && (
                                    <source
                                        src={`${uiConfig.filezServerAddress}/api/file/get/${this.props.file._id}`}
                                        type={f.mime_type}
                                    />
                                )}
                            </video>
                        </div>
                    </div>
                )}
            </div>
        );
    };
}
