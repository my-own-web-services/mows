import { Component } from "preact";
import { FilezFile } from "../../types";

interface AudioProps {
    readonly file: FilezFile;
}
interface AudioState {}
export default class Audio extends Component<AudioProps, AudioState> {
    render = () => {
        return (
            <div className="Audio">
                <audio controls>
                    <source
                        src={`/api/get_file/${this.props.file._key}`}
                        type={this.props.file.mimeType}
                    />
                </audio>
            </div>
        );
    };
}
