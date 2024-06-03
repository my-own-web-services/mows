import { Component, createRef } from "preact";
import { G } from "../../App";
import "./Audio.scss";
import { FilezFile } from "@firstdorsal/filez-client";

interface AudioProps {
    readonly g: G;
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
                        src={`${this.props.g.uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}`}
                        type={this.props.file.mimeType}
                    />
                </audio>
            </div>
        );
    };
}
