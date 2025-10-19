import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { FilezFile } from "filez-client-typescript";
import { PureComponent, type CSSProperties } from "react";
import ImageViewer from "./formats/ImageViewer";

interface FileViewerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly file: FilezFile;
    readonly fileVersion?: number;
    readonly appId?: string;
}

interface FileViewerState {}

export default class FileViewer extends PureComponent<FileViewerProps, FileViewerState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: FileViewerProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        const { file } = this.props;
        return (
            <div style={{ ...this.props.style }} className={cn(`FileViewer`, this.props.className)}>
                {(() => {
                    const fileType = file.mime_type;
                    if (fileType.startsWith("image/")) {
                        return <ImageViewer file={file} />;
                    } else {
                        return <span>{file.name}</span>;
                    }
                })()}
            </div>
        );
    };
}
