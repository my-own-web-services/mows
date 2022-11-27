import { Component } from "preact";
import { FilezFile } from "../../types";
import "./Image.scss";
interface ImageProps {
    readonly file: FilezFile;
}
interface ImageState {}
export default class Image extends Component<ImageProps, ImageState> {
    render = () => {
        const f = this.props.file;
        return (
            <div className="Image">
                {f.mimeType.startsWith("image/") ? (
                    <img loading={"lazy"} src={`/api/get_file/${f._key}`} />
                ) : null}
            </div>
        );
    };
}
