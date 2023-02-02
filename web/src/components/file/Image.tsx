import { Component } from "preact";
import { G } from "../../App";
import { FilezFile, ProcessedImage } from "../../types";
import "./Image.scss";
interface ImageProps {
    readonly g: G;
    readonly file: FilezFile;
}
interface ImageState {}
export default class Image extends Component<ImageProps, ImageState> {
    render = () => {
        const f = this.props.file;
        const processedImage = f.appData?.image?.result as ProcessedImage;
        if (!processedImage) return;
        return (
            <div className="Image">
                <img
                    src={`${this.props.g.uiConfig.filezServerAddress}/api/get_file/${f._id}/image/500.avif`}
                    loading="lazy"
                    width={processedImage.width}
                    height={processedImage.height}
                />
            </div>
        );
    };
}
