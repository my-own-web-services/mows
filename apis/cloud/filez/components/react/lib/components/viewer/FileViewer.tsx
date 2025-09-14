import { FilezFile } from "filez-client-typescript";
import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../FilezContext";
import { isText } from "../../utils";
import Audio from "./formats/Audio";
import Image from "./formats/Image";
import Text from "./formats/Text";
import Video from "./formats/Video";

interface FilezFileViewerProps {
    readonly file?: FilezFile;
    readonly fileId?: string;
    readonly style?: CSSProperties;
    readonly viewMode: FileViewerViewMode;
    readonly width?: number;
    readonly disablePreviewFalback?: boolean;
}

export const FileViewerViewMode = {
    Preview: "Preview",
    Full: "Full",
    Zoomable: "Zoomable"
};

export type FileViewerViewMode = (typeof FileViewerViewMode)[keyof typeof FileViewerViewMode];

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
            if (this.context) {
                const response = await this.context.filezClient.api.getFiles({
                    file_ids: [this.props.fileId]
                });
                this.setState({ file: response.data.data?.files[0] ?? null });
            }
        }
    };

    componentDidUpdate = async (prevProps: Readonly<FilezFileViewerProps>) => {
        if (this.props.file && this.props.file.id !== this.state.file?.id) {
            this.setState({ file: this.props.file });
        } else if (
            typeof this.props.fileId === "string" &&
            this.props.fileId !== prevProps.fileId
        ) {
            if (this.context) {
                const response = await this.context.filezClient.api.getFiles({
                    file_ids: [this.props.fileId]
                });
                this.setState({ file: response.data.data?.files[0] ?? null });
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
            this.props.viewMode === FileViewerViewMode.Preview && this.props.disablePreviewFalback;

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
                        return <div>Can&apos;t display this type of file: {fileType}</div>;
                    }
                })()}
            </div>
        );
    };
}
