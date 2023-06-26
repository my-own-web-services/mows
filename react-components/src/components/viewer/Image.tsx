import { FilezFile, ProcessedImage } from "@firstdorsal/filez-client";
import { PureComponent } from "react";
import { UiConfig } from "../../FilezProvider";

interface ImageProps {
    readonly file: FilezFile;
    readonly itemWidth?: number;
    readonly uiConfig: UiConfig;
}

interface ImageState {}

export default class Image extends PureComponent<ImageProps, ImageState> {
    constructor(props: ImageProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        const f = this.props.file;
        const processedImage = f.appData?.image?.result as ProcessedImage;
        const [previewWidth, shouldUseOriginal] = getImagePreviewWidth(
            f,
            this.props.itemWidth ?? 500
        );

        const isDisplayable = isImageDisplayable(f);

        if (!isDisplayable && !processedImage) return;

        return (
            <div className="Image">
                {processedImage && !shouldUseOriginal ? (
                    <img
                        src={`${this.props.uiConfig.filezServerAddress}/api/get_file/${f._id}/image/${previewWidth}.avif?c`}
                        loading="lazy"
                        width={processedImage.width}
                        height={processedImage.height}
                        draggable={false}
                    />
                ) : (
                    <img
                        src={`${this.props.uiConfig.filezServerAddress}/api/get_file/${f._id}?c`}
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
    if (diplayableMimeTypes.includes(filezFile.mimeType)) return true;
    return false;
};

export const getImagePreviewWidth = (filezFile: FilezFile, viewportItemWidth: number) => {
    viewportItemWidth = viewportItemWidth * window.devicePixelRatio;

    const maybeImageAddon = filezFile.appData.image;
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
