import { FilezFile } from "filez-client-typescript";

import { PureComponent } from "react";

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
        // TODO
        return <img style={{ height: "100%" }} src={`/file-icons/.svg`} />;
    };

    render = () => {
        return (
            <div style={this.props.style} className="FileIcon">
                {this.getIcon()}
            </div>
        );
    };
}
