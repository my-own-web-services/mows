import { PureComponent } from "react";
import update from "immutability-helper";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

interface FileAccessControlProps {
    readonly file: FilezFile;
}

interface FileAccessControlState {}

export default class FileAccessControl extends PureComponent<
    FileAccessControlProps,
    FileAccessControlState
> {
    constructor(props: FileAccessControlProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        return <div className="FileAccessControl"></div>;
    };
}
