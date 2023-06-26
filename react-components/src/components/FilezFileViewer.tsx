import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client";
import Image from "./viewer/Image";

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
        prevProps: Readonly<FilezFileViewerProps>,
        prevState: Readonly<FilezFileViewerState>,
        snapshot?: any
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

        const fileType = this.state.file.mimeType;
        if (fileType.startsWith("image/")) {
            return (
                <div className="FilezFileViewer" style={this.props.style}>
                    <Image file={this.state.file} uiConfig={this.context.uiConfig}></Image>
                </div>
            );
        } else {
            return (
                <div className="FilezFileViewer" style={this.props.style}>
                    Can't display this kind of file: {fileType}
                </div>
            );
        }
    };
}
