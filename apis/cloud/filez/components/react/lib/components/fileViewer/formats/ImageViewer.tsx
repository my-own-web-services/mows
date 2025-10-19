import { cn } from "@/lib/utils";
import { FilezFile } from "filez-client-typescript";
import { PureComponent, type CSSProperties } from "react";

interface ImageViewerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly file: FilezFile;
    readonly fileVersion?: number;
}

interface ImageViewerState {}

export default class ImageViewer extends PureComponent<ImageViewerProps, ImageViewerState> {
    constructor(props: ImageViewerProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        const { file, fileVersion } = this.props;
        const appId = "filez-app";
        const appPath = "fileViewer";
        const url = `/api/file/get/${file.id}/${fileVersion || 0}/${appId}/${appPath}`;
        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`ImageViewer`, this.props.className)}
            >
                <img src={url} loading="eager" draggable={false} />
            </div>
        );
    };
}
