import { PureComponent } from "react";
import { fileIcons } from "file-icons/src/icons/fileIcons";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { rawFileEndings } from "../../utils";

interface FileIconProps {
    readonly file: FilezFile;
    readonly style?: React.CSSProperties;
}

interface FileIconState {}

export default class FileIcon extends PureComponent<FileIconProps, FileIconState> {
    constructor(props: FileIconProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    getIcon = () => {
        return (
            <img
                style={{ height: "100%" }}
                src={`/file-icons/${getIconName(this.props.file.name)}.svg`}
            ></img>
        );
    };

    render = () => {
        return (
            <div style={this.props.style} className="FileIcon">
                {this.getIcon()}
            </div>
        );
    };
}

export const getIconName = (name?: string) => {
    if (!name) return fileIcons.defaultIcon.name;

    const fileName = name.toLowerCase();

    // TODO this should be based on mime type and not on file extension but the mappings for that would have to be created manually

    // get the icon from the extension
    const icon = fileIcons.icons.find(
        icon =>
            icon.fileExtensions?.some(ext => fileName.endsWith(`.${ext}`)) ||
            icon.fileNames?.includes(fileName)
    );

    if (icon) {
        return icon.name;
    }

    if (fileName.endsWith(`.xmp`)) return "xml";

    if (rawFileEndings.some(ext => fileName.endsWith(`.${ext}`))) {
        return "image";
    }

    return fileIcons.defaultIcon.name;
};
