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
                <img loading={"lazy"} src={`/api/get_file/${f._id}`} />
            </div>
        );
    };
}
