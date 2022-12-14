import { Component } from "preact";
import { ReducedFilezFile } from "../../types";

interface AudioProps {
    readonly file: ReducedFilezFile;
}
interface AudioState {}
export default class Audio extends Component<AudioProps, AudioState> {
    render = () => {
        return (
            <div className="Audio">
                <audio controls>
                    <source
                        src={`/api/get_file/${this.props.file._id}`}
                        type={this.props.file.mimeType}
                    />
                </audio>
            </div>
        );
    };
}
