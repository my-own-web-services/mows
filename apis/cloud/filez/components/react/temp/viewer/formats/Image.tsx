import { FilezFile } from "filez-client-typescript";
import { PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezContext";
import { FileViewerViewMode } from "../FileViewer";

interface ImageProps {
    readonly file: FilezFile;
    readonly itemWidth?: number;
    readonly viewMode: FileViewerViewMode;
    readonly disableFallback?: boolean;
}

interface ImageState {
    readonly isGif: boolean;
}

export default class Image extends PureComponent<ImageProps, ImageState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: ImageProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        const f = this.props.file;

        const uiConfig = this.context?.clientConfig;
        if (!uiConfig) return;

        return (
            <div className="Image" style={{ width: "100%", display: "relative" }}>
                <img
                    src={`${uiConfig.serverUrl}/api/file/get/${f.id}?c`}
                    loading="eager"
                    draggable={false}
                />
            </div>
        );
    };
}
