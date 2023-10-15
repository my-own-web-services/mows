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
}

interface FilezFileViewerState {
    readonly file?: FilezFile | null;
    readonly fileId?: string;
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
            file: null
        };
    }

    componentDidMount = async () => {
        if (this.props.file !== undefined) {
            this.setState({ file: this.props.file });
        } else if (this.props.fileId !== undefined) {
            const filezClient = this?.context?.filezClient;

            if (filezClient) {
                const file = await filezClient.get_file_info(this.props.fileId);

                this.setState({ file });
            }
        }
    };

    componentDidUpdate = async (
        _prevProps: Readonly<FilezFileViewerProps>,
        _prevState: Readonly<FilezFileViewerState>,
        _snapshot?: any
    ) => {
        if (this.props.file && this.props.file._id !== this.state.file?._id) {
            this.setState({ file: this.props.file });
        } else if (this.props.fileId && this.props.fileId !== this.state.fileId) {
            if (this.context !== null) {
                const filezClient = this?.context?.filezClient;

                if (filezClient) {
                    const file = await this.context.filezClient.get_file_info(this.props.fileId);
                    this.setState({ file, fileId: this.props.fileId });
                }
            }
        }
    };

    render = () => {
        if (!this.state.file) {
            return <div></div>;
        }
        if (!this.context) {
            return <div></div>;
        }

        return (
            <div className="Filez FileViewer" style={this.props.style}>
                {(() => {
                    const fileType = this.state.file.mimeType;
                    if (fileType.startsWith("image/")) {
                        return (
                            <Image file={this.state.file} uiConfig={this.context.uiConfig}></Image>
                        );
                    } else if (fileType.startsWith("audio/")) {
                        return (
                            <Audio file={this.state.file} uiConfig={this.context.uiConfig}></Audio>
                        );
                    } else if (fileType.startsWith("video/")) {
                        return (
                            <Video file={this.state.file} uiConfig={this.context.uiConfig}></Video>
                        );
                    } else if (isText(this.state.file)) {
                        return (
                            <Text file={this.state.file} uiConfig={this.context.uiConfig}></Text>
                        );
                    } else {
                        return <div>Can't display this type of file: {fileType}</div>;
                    }
                })()}
            </div>
        );
    };
}
