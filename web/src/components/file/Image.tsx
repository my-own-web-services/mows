import { Component } from "preact";
import { G } from "../../App";
import { FilezFile, ProcessedImage } from "../../types";
import { imageGetPreviewWidth } from "../../utils/imageGetPreviewWidth";
import "./Image.scss";
interface ImageProps {
    readonly g: G;
    readonly file: FilezFile;
    readonly itemWidth?: number;
}
interface ImageState {}
export default class Image extends Component<ImageProps, ImageState> {
    render = () => {
        const f = this.props.file;
        const processedImage = f.appData?.image?.result as ProcessedImage;
        const [previewWidth, shouldUseOriginal] = imageGetPreviewWidth(
            f,
            this.props.itemWidth ?? 500
        );

        return (
            <div className="Image">
                {processedImage && !shouldUseOriginal ? (
                    <img
                        src={`${this.props.g.uiConfig.filezServerAddress}/api/get_file/${f._id}/image/${previewWidth}.avif?c`}
                        loading="lazy"
                        width={processedImage.width}
                        height={processedImage.height}
                        draggable={false}
                    />
                ) : (
                    <img
                        src={`${this.props.g.uiConfig.filezServerAddress}/api/get_file/${f._id}?c`}
                        loading="lazy"
                        draggable={false}
                    />
                )}
            </div>
        );
    };
}
