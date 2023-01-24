import { Component } from "preact";
import { FilezFile, ProcessedImage } from "../../types";
import "./Image.scss";
interface ImageProps {
    readonly file: FilezFile;
}
interface ImageState {}
export default class Image extends Component<ImageProps, ImageState> {
    render = () => {
        const f = this.props.file;
        const processedImage = f.appData?.imageProcessor?.result as ProcessedImage;
        if (!processedImage) return;
        return (
            <div className="Image">
                <img
                    src={`/api/get_file/${f._id}/imageProcessor/500.avif`}
                    loading="lazy"
                    width={processedImage.width}
                    height={processedImage.height}
                />
            </div>
        );
    };
}
