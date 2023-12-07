import { Component, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FileViewerViewMode } from "../FileViewer";
import Image from "./Image";

interface AudioProps {
    readonly file: FilezFile;
    readonly viewMode?: FileViewerViewMode;
    readonly disableFallback?: boolean;
}
interface AudioState {}
export default class Audio extends Component<AudioProps, AudioState> {
    private audioRef = createRef<HTMLAudioElement>();
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    componentDidUpdate = () => {
        if (this.audioRef.current) {
            this.audioRef.current.load();
        }
    };
    render = () => {
        const uiConfig = this.context?.uiConfig;
        if (!uiConfig) return;
        return (
            <div className="Audio">
                {this.props.viewMode === FileViewerViewMode.Preview ? (
                    <Image file={this.props.file} viewMode={this.props.viewMode}></Image>
                ) : (
                    <audio ref={this.audioRef} controls>
                        <source
                            src={`${uiConfig.filezServerAddress}/api/file/get/${this.props.file._id}`}
                            type={this.props.file.mime_type}
                        />
                    </audio>
                )}
            </div>
        );
    };
}
