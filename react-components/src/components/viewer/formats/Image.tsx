import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FileViewerViewMode } from "../FileViewer";
import { match } from "ts-pattern";
import ImageRegions from "../ImageRegions";
import ReactVirtualizedAutoSizer from "react-virtualized-auto-sizer";
import ZoomImage from "../ZoomImage";
import { ProcessedImage } from "@firstdorsal/filez-client/dist/js/apiTypes/ProcessedImage";

interface ImageProps {
    readonly file: FilezFile;
    readonly itemWidth?: number;
    readonly viewMode: FileViewerViewMode;
    readonly disableFallback?: boolean;
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
        if (!processedImage && this.props.disableFallback) return;
        const uiConfig = this.context?.uiConfig;
        if (!uiConfig) return;

        const rotationStyle = getRotationStyle(f);
        const rotation = getRotation(f);

        return (
            <div className="Image" style={{ width: "100%", display: "relative" }}>
                {processedImage && this.props.viewMode !== FileViewerViewMode.Zoomable && (
                    <ReactVirtualizedAutoSizer>
                        {({ height, width }) => {
                            return (
                                <ImageRegions
                                    itemHeight={processedImage.height}
                                    itemWidth={processedImage.width}
                                    viewerWidth={width}
                                    viewerHeight={height}
                                    rotation={rotation}
                                    viewMode={this.props.viewMode}
                                    file={f}
                                />
                            );
                        }}
                    </ReactVirtualizedAutoSizer>
                )}
                {this.props.viewMode !== FileViewerViewMode.Zoomable &&
                    (processedImage && !shouldUseOriginal ? (
                        <img
                            style={{ ...rotationStyle }}
                            src={`${uiConfig.filezServerAddress}/api/file/get/${f._id}/image/previews/${previewWidth}.avif?c`}
                            loading="eager"
                            width={processedImage.width}
                            height={processedImage.height}
                            draggable={false}
                        />
                    ) : (
                        <img
                            src={`${uiConfig.filezServerAddress}/api/file/get/${f._id}?c`}
                            loading="eager"
                            draggable={false}
                        />
                    ))}
            </div>
        );
    };
}

/*

                {this.props.viewMode === FileViewerViewMode.Zoomable && <ZoomImage file={f} />}

                {
                    <ReactVirtualizedAutoSizer>
                        {({ height, width }) => {
                            return (
                                <ImageRegions
                                    itemHeight={processedImage.height}
                                    itemWidth={processedImage.width}
                                    viewerWidth={width}
                                    viewerHeight={height}
                                    rotation={rotation}
                                    file={f}
                                />
                            );
                        }}
                    </ReactVirtualizedAutoSizer>
                }

*/

export enum ImageOrientation {
    "Horizontal (normal)" = 1,
    "Mirror horizontal" = 2,
    "Rotate 180" = 3,
    "Mirror vertical" = 4,
    "Mirror horizontal and rotate 270 CW" = 5,
    "Rotate 90 CW" = 6,
    "Mirror horizontal and rotate 90 CW" = 7,
    "Rotate 270 CW" = 8
}

export const getRotation = (filezFile: FilezFile): ImageOrientation | undefined => {
    const rotation = filezFile.app_data?.metadata?.result?.exifdata?.Orientation;
    return match(rotation)
        .with("Horizontal (normal)", () => ImageOrientation["Horizontal (normal)"])
        .with("Mirror horizontal", () => ImageOrientation["Mirror horizontal"])
        .with("Rotate 180", () => ImageOrientation["Rotate 180"])
        .with("Mirror vertical", () => ImageOrientation["Mirror vertical"])
        .with(
            "Mirror horizontal and rotate 270 CW",
            () => ImageOrientation["Mirror horizontal and rotate 270 CW"]
        )
        .with("Rotate 90 CW", () => ImageOrientation["Rotate 90 CW"])
        .with(
            "Mirror horizontal and rotate 90 CW",
            () => ImageOrientation["Mirror horizontal and rotate 90 CW"]
        )
        .with("Rotate 270 CW", () => ImageOrientation["Rotate 270 CW"])
        .otherwise(() => undefined);
};

export const getRotationStyle = (filezFile: FilezFile) => {
    const rotation = filezFile.app_data?.metadata?.result?.exifdata?.Orientation;

    /*
    1 = Horizontal (normal)
    2 = Mirror horizontal
    3 = Rotate 180
    4 = Mirror vertical
    5 = Mirror horizontal and rotate 270 CW
    6 = Rotate 90 CW
    7 = Mirror horizontal and rotate 90 CW
    8 = Rotate 270 CW
    */

    const transform = match(rotation)
        .with("Mirror horizontal", () => "scaleX(-1)")
        .with("Rotate 180", () => "rotate(180deg)")
        .with("Mirror vertical", () => "scaleY(-1)")
        .with("Mirror horizontal and rotate 270 CW", () => "scaleX(-1) rotate(270deg)")
        .with("Rotate 90 CW", () => "rotate(90deg)")
        .with("Mirror horizontal and rotate 90 CW", () => "scaleX(-1) rotate(90deg)")
        .with("Rotate 270 CW", () => "rotate(270deg)")
        .otherwise(() => undefined);

    if (!transform) return {};

    const style: CSSProperties = {
        transform
    };

    return style;
};

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
