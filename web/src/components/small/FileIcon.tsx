import { Component } from "preact";
import { mdiFileImage, mdiFileVideo } from "@mdi/js";
import Icon from "@mdi/react";
import { JSXInternal } from "preact/src/jsx";
import { FilezFile } from "@firstdorsal/filez-frontend";

interface FileIconProps {
    readonly file: FilezFile;
    readonly style?: JSXInternal.CSSProperties;
}
interface FileIconState {}
export default class FileIcon extends Component<FileIconProps, FileIconState> {
    render = () => {
        const { mimeType } = this.props.file;
        const size = 0.8;

        // TODO https://github.com/PKief/vscode-material-icon-theme/discussions/1918
        return;

        if (mimeType.startsWith("image/")) {
            return (
                <Icon style={this.props.style} path={mdiFileImage} size={size} color="lightgreen" />
            );
        } else if (mimeType.startsWith("video/")) {
            return <Icon style={this.props.style} path={mdiFileVideo} size={size} color="orange" />;
        }
    };
}
