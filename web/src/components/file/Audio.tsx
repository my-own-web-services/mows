import { Component, createRef } from "preact";
import { FilezFile } from "../../types";
import "./Audio.scss";

interface AudioProps {
    readonly file: FilezFile;
}
interface AudioState {}
export default class Audio extends Component<AudioProps, AudioState> {
    private audioRef = createRef<HTMLAudioElement>();

    componentDidUpdate = () => {
        if (this.audioRef.current) {
            this.audioRef.current.load();
        }
    };
    render = () => {
        return (
            <div className="Audio">
                <audio ref={this.audioRef} controls>
                    <source
                        src={`/api/get_file/${this.props.file._id}`}
                        type={this.props.file.mimeType}
                    />
                </audio>
            </div>
        );
    };
}
