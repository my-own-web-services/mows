import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";
import Image from "./formats/Image";
import Audio from "./formats/Audio";
import Video from "./formats/Video";
import Text from "./formats/Text";
import { isText } from "../../utils";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

interface FilezFileViewerProps {
    readonly file?: FilezFile;
    readonly fileId?: string;
    readonly style?: CSSProperties;
    readonly viewMode: FileViewerViewMode;
    readonly width?: number;
    readonly disablePreviewFalback?: boolean;
}

export enum FileViewerViewMode {
    Preview,
    Full,
    Zoomable
}

interface FilezFileViewerState {
    readonly file?: FilezFile | null;
}

export default class FilezFileViewer extends PureComponent<
    FilezFileViewerProps,
    FilezFileViewerState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: FilezFileViewerProps) {
        super(props);
        this.state = {
            file: props.file
        };
    }

    componentDidMount = async () => {
        if (this.props.fileId !== undefined) {
            const filezClient = this?.context?.filezClient;

            if (filezClient) {
                const files = await filezClient.get_file_infos([
                    this.props.fileId
                ]);

                this.setState({ file: files[0] });
            }
        }
    };

    componentDidUpdate = async (prevProps: Readonly<FilezFileViewerProps>) => {
        if (this.props.file && this.props.file._id !== this.state.file?._id) {
            this.setState({ file: this.props.file });
        } else if (
            this.props.fileId &&
            this.props.fileId !== prevProps.fileId
        ) {
            if (this.context !== null) {
                const filezClient = this?.context?.filezClient;

                if (filezClient) {
                    const files = await this.context.filezClient.get_file_infos(
                        [this.props.fileId]
                    );
                    this.setState({ file: files[0] });
                }
            }
        }
    };

    render = () => {
        if (!this.state.file) {
            return;
        }
        if (!this.context) {
            return;
        }

        const disableFallback =
            this.props.viewMode === FileViewerViewMode.Preview &&
            this.props.disablePreviewFalback;

        return (
            <div className="Filez FileViewer" style={this.props.style}>
                {(() => {
                    const fileType = this.state.file.mime_type;
                    if (fileType.startsWith("image/")) {
                        return (
                            <Image
                                itemWidth={this.props.width}
                                viewMode={this.props.viewMode}
                                file={this.state.file}
                                disableFallback={disableFallback}
                            />
                        );
                    } else if (fileType.startsWith("audio/")) {
                        return (
                            <Audio
                                viewMode={this.props.viewMode}
                                disableFallback={disableFallback}
                                file={this.state.file}
                            />
                        );
                    } else if (fileType.startsWith("video/")) {
                        return (
                            <Video
                                viewMode={this.props.viewMode}
                                disableFallback={disableFallback}
                                file={this.state.file}
                            />
                        );
                    } else if (isText(this.state.file)) {
                        return (
                            <Text
                                viewMode={this.props.viewMode}
                                disableFallback={disableFallback}
                                file={this.state.file}
                            />
                        );
                    } else {
                        return (
                            <div>
                                Can&apos;t display this type of file: {fileType}
                            </div>
                        );
                    }
                })()}
            </div>
        );
    };
}
