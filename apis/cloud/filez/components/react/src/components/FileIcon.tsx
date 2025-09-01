import { FilezFile } from "filez-client-typescript";
import { CSSProperties, PureComponent } from "react";

interface FileIconProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly file: FilezFile;
}

interface FileIconState {}

export default class FileIcon extends PureComponent<FileIconProps, FileIconState> {
    constructor(props: FileIconProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`FileIcon ${this.props.className ?? ""}`}
            >
                <img
                    style={{ height: "100%" }}
                    src={`/file-icons/${getIconName(this.props.file)}.svg`}
                />
            </div>
        );
    };
}

const getIconName = (filezFile: FilezFile): string => {
    return "file"; // TODO: implement actual logic
};
