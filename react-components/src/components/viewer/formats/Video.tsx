import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { PureComponent, createRef } from "react";

import { FileViewerViewMode } from "../FileViewer";
import { FilezContext } from "../../../FilezProvider";
//@ts-ignore
import shaka from "shaka-player/dist/shaka-player.ui";
import "../../utils/controls.css";

interface VideoProps {
    readonly file: FilezFile;
    readonly viewMode?: FileViewerViewMode;
    readonly disableFallback?: boolean;
}

interface VideoState {}

export default class Video extends PureComponent<VideoProps, VideoState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    private videoRef: React.RefObject<HTMLVideoElement>;
    private uiContainerRef: React.RefObject<HTMLDivElement>;

    player?: shaka.Player;

    constructor(props: VideoProps) {
        super(props);
        this.state = {};
        this.videoRef = createRef<HTMLVideoElement>();
        this.uiContainerRef = createRef<HTMLDivElement>();
    }

    componentDidMount = async () => {
        await this.init();
        await this.updateSource();
    };

    componentDidUpdate = async (newProps: VideoProps) => {
        if (this.props.file._id !== newProps.file._id) {
            await this.updateSource();
        }
    };

    init = async () => {
        if (this.videoRef.current === null) return;
        if (this.player !== undefined) return;
        this.player = new shaka.Player();
        const ui = new shaka.ui.Overlay(
            this.player,
            this.uiContainerRef.current,
            this.videoRef.current
        );

        const playerUiConfig = {
            controlPanelElements: [
                "play_pause",
                "time_and_duration",
                "spacer",
                "mute",
                "volume",
                "fullscreen",
                "overflow_menu"
            ],
            overflowMenuButtons: [
                "captions",
                "quality",
                "picture_in_picture",
                "cast",
                "playback_rate",
                "statistics",
                "loop",
                "remote",
                "language"
            ]
        };

        ui.configure(playerUiConfig);

        ui.getControls();

        this.player
            .getNetworkingEngine()
            .registerRequestFilter(function (request_type: any, request: any) {
                request.allowCrossSiteCredentials = true;
            });
        await this.player.attach(this.videoRef.current);
    };

    updateSource = async () => {
        const filezUiConfig = this.context?.uiConfig;

        if (filezUiConfig === undefined) return;

        const hasConvertedVersion = this.hasConvertedVersion(this.props.file);

        const [url, mimeType] = hasConvertedVersion
            ? [
                  `${filezUiConfig.filezServerAddress}/api/file/get/${this.props.file._id}/video/manifest.mpd?c`,
                  "application/dash+xml"
              ]
            : [
                  `${filezUiConfig.filezServerAddress}/api/file/get/${this.props.file._id}`,
                  this.shakaMimeTypeFix(this.props.file.mime_type)
              ];

        const startTime = 0;
        this.player.load(url, startTime, mimeType);
        this.player.resetConfiguration();
    };

    shakaMimeTypeFix = (mimeType: string) => {
        if (mimeType === "video/quicktime") return "video/mp4";
        return mimeType;
    };

    hasConvertedVersion = (file: FilezFile) => {
        return (
            file.app_data.video?.status === "finished" &&
            typeof file.app_data.video?.error !== "string"
        );
    };

    componentWillUnmount = () => {
        this.player?.destroy();
        this.player = undefined;
    };

    render = () => {
        return (
            <div
                style={{ width: "100%", height: "100%" }}
                ref={this.uiContainerRef}
            >
                <video
                    style={{ width: "100%", height: "100%" }}
                    ref={this.videoRef}
                />
            </div>
        );
    };
}
