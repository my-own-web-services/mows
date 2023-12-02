import { ProcessedImage } from "@firstdorsal/filez-client";
import { PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FileViewerViewMode } from "../FileViewer";

interface ImageProps {
    readonly file: FilezFile;
    readonly itemWidth?: number;
    readonly viewMode?: FileViewerViewMode;
}

interface ImageState {}

export default class Image extends PureComponent<ImageProps, ImageState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: ImageProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        const f = this.props.file;
        const processedImage = f.app_data?.image?.result as ProcessedImage;
        const [previewWidth, shouldUseOriginal] = getImagePreviewWidth(
            f,
            this.props.itemWidth ?? 500
        );

        const isDisplayable = isImageDisplayable(f);

        if (!isDisplayable && !processedImage) return;

        const uiConfig = this.context?.uiConfig;
        if (!uiConfig) return;

        return (
            <div className="Image" style={{ width: "100%" }}>
                {processedImage && !shouldUseOriginal ? (
                    <img
                        src={`${uiConfig.filezServerAddress}/api/file/get/${f._id}/image/${previewWidth}.avif?c`}
                        loading="lazy"
                        width={processedImage.width}
                        height={processedImage.height}
                        draggable={false}
                    />
                ) : (
                    <img
                        src={`${uiConfig.filezServerAddress}/api/file/get/${f._id}?c`}
                        loading="lazy"
                        draggable={false}
                    />
                )}
            </div>
        );
    };
}

export const isImageDisplayable = (filezFile: FilezFile) => {
    const diplayableMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (diplayableMimeTypes.includes(filezFile.mime_type)) return true;
    return false;
};

export const getImagePreviewWidth = (filezFile: FilezFile, viewportItemWidth: number) => {
    viewportItemWidth = viewportItemWidth * window.devicePixelRatio;

    const maybeImageAddon = filezFile.app_data.image;
    if (maybeImageAddon) {
        const imageAddon: ImageAddon = maybeImageAddon;
        if (imageAddon.result) {
            const resolutions = imageAddon.result.resolutions;
            resolutions.sort((a, b) => a - b);
            let res = 0;

            for (let i = 0; i < resolutions.length; i++) {
                if (resolutions[i] >= viewportItemWidth) {
                    res = resolutions[i];
                    break;
                }
            }

            if (res === 0) {
                res = resolutions[resolutions.length - 1];
            }

            const shouldUseOriginal = res < viewportItemWidth;

            return [res, shouldUseOriginal];
        }
    }
    return [0, true];
};

interface ImageAddon {
    error: null | string;
    finishedAt: string;
    startedAt: string;
    status: "finished" | "processing";
    result: {
        width: number;
        height: number;
        resolutions: number[];
    } | null;
}
