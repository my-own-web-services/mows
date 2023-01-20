import { Component, createRef } from "preact";
import { FilezFile } from "../../types";
import "./Video.scss";

interface VideoProps {
    readonly file: FilezFile;
}
interface VideoState {}
export default class Video extends Component<VideoProps, VideoState> {
    private videoRef = createRef<HTMLVideoElement>();

    componentDidUpdate = (newProps: VideoProps) => {
        if (this.videoRef.current && this.props.file._id !== newProps.file._id) {
            this.videoRef.current.load();
        }
    };

    render = () => {
        return (
            <div className="Video">
                <video ref={this.videoRef} controls>
                    <source
                        src={`/api/get_file/${this.props.file._id}`}
                        type={this.props.file.mimeType}
                    />
                </video>
            </div>
        );
    };
}
