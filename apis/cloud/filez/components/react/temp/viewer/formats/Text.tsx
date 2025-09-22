import { FilezFile } from "filez-client-typescript";
import { PureComponent } from "react";
import { FilezContext } from "../../../FilezContext";
import { FileViewerViewMode } from "../FileViewer";

interface TextProps {
    readonly file: FilezFile;
    readonly viewMode?: FileViewerViewMode;
    readonly disableFallback?: boolean;
}

interface TextState {
    readonly textContent?: string;
}

export default class Text extends PureComponent<TextProps, TextState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: TextProps) {
        super(props);
        this.state = {
            textContent: undefined
        };
    }

    componentDidMount = async () => {
        await this.init();
    };

    componentDidUpdate = async (prevProps: TextProps) => {
        if (prevProps.file.id !== this.props.file.id) {
            await this.init();
        }
    };

    init = async () => {
        // TODO
        /*
        if (!this.context) {
            throw new Error("FileList must be used inside Filez to provide the FilezContext");
        } else {
            // 10 MB
            const fileSizeLimit = 10 * 1024 * 1024;

            if (this.props.file.size > fileSizeLimit) {
                this.setState({
                    textContent: `File size is ${bytesToHumanReadableSize(
                        this.props.file.size
                    )}, which is larger than the limit of ${bytesToHumanReadableSize(
                        fileSizeLimit
                    )}.`
                });
                return;
            }
            const res = await this.context.filezClient.get_file(
                this.props.file.id,
                this.props.viewMode === FileViewerViewMode.Preview
                    ? { range: { from: 0, to: 100 }, cache: true }
                    : undefined
            );

            const text = await res.text();

            this.setState({
                textContent: text
            });
        }*/
    };

    render = () => {
        return (
            <div
                className="Text"
                style={{
                    overflow: this.props.viewMode === FileViewerViewMode.Preview ? "hidden" : "auto"
                }}
            >
                <pre>{this.state.textContent}</pre>
            </div>
        );
    };
}
