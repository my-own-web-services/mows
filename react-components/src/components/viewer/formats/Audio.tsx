import { Component, createRef } from "react";
import { FilezFile } from "@firstdorsal/filez-client";
import { UiConfig } from "../../../FilezProvider";

interface AudioProps {
    readonly file: FilezFile;
    readonly uiConfig: UiConfig;
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
        const uiConfig = this.props.uiConfig;
        return (
            <div className="Audio">
                <audio ref={this.audioRef} controls>
                    <source
                        src={`${uiConfig.filezServerAddress}/api/get_file/${this.props.file._id}`}
                        type={this.props.file.mimeType}
                    />
                </audio>
            </div>
        );
    };
}
