import { FilezFile } from "filez-client-typescript";
import { PureComponent, createRef } from "react";
import { FilezContext } from "../../../../lib/FilezContext";
import { FileViewerViewMode } from "../FileViewer";
//@ts-ignore
import shaka from "shaka-player/dist/shaka-player.ui";
//@ts-ignore
import "./video/controls.css";

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
        //@ts-ignore
        this.videoRef = createRef<HTMLVideoElement>();
        //@ts-ignore
        this.uiContainerRef = createRef<HTMLDivElement>();
    }

    componentDidMount = async () => {
        await this.init();
        await this.updateSource();
    };

    componentDidUpdate = async (newProps: VideoProps) => {
        if (this.props.file.id !== newProps.file.id) {
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

        this.player.getNetworkingEngine().registerRequestFilter(function (
            _request_type: any,
            request: any
        ) {
            request.allowCrossSiteCredentials = true;
        });
        await this.player.attach(this.videoRef.current);
    };

    updateSource = async () => {
        const filezUiConfig = this.context?.clientConfig;

        if (!filezUiConfig) return;

        const hasConvertedVersion = this.hasConvertedVersion(this.props.file);

        const [url, mimeType] = hasConvertedVersion
            ? [
                  `${filezUiConfig.serverUrl}/api/file/get/${this.props.file.id}/video/manifest.mpd?c`,
                  "application/dash+xml"
              ]
            : [
                  `${filezUiConfig.serverUrl}/api/file/get/${this.props.file.id}`,
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

    hasConvertedVersion = (_file: FilezFile) => {
        return true;
        // TODO
        /*
        return (
            file.app_data.video?.status === "finished" &&
            typeof file.app_data.video?.error !== "string"
        );*/
    };

    componentWillUnmount = () => {
        this.player?.destroy();
        this.player = undefined;
    };

    render = () => {
        return (
            <div style={{ width: "100%", height: "100%" }} ref={this.uiContainerRef}>
                <video style={{ width: "100%", height: "100%" }} ref={this.videoRef} />
            </div>
        );
    };
}
