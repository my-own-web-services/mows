import { Component } from "preact";
import { FilezFile, ProcessedImage } from "../../types";

interface AudioPreviewProps {
    readonly file: FilezFile;
}
interface AudioPreviewState {}
export default class AudioPreview extends Component<AudioPreviewProps, AudioPreviewState> {
    render = () => {
        const f = this.props.file;

        const processedImage = f.appData?.imageProcessor?.result as ProcessedImage;
        if (!processedImage) return;

        return (
            <div className="AudioPreview">
                <img
                    src={`/api/get_file/${f._id}/imageProcessor/100.avif`}
                    loading="lazy"
                    width={processedImage.width}
                    height={processedImage.height}
                />
            </div>
        );
    };
}

/*
export const getSourceSet = (pi: ProcessedImage, f: FilezFile) => {
    let srcSet = "";
    for (let i = 0; i < pi.resolutions.length; i++) {
        srcSet += `/api/get_file/${f._id}/imageProcessor/${pi.resolutions[i]}.avif ${pi.resolutions[i]}w,`;
    }
    return srcSet;
};
*/
