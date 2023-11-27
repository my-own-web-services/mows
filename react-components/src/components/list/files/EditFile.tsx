import { PureComponent, createRef } from "react";
import FileComp from "./UploadFile";
import Permission from "../permissions/Permission";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import MetaEditor from "../../metaEditor/FileMetaEditor";

interface EditFileProps {
    readonly resourceIds?: string[];
}

interface EditFileState {
    readonly files: FilezFile[];
}

export default class EditFile extends PureComponent<EditFileProps, EditFileState> {
    fileCompRef: React.RefObject<FileComp>;
    oncePermissionRef: React.RefObject<Permission>;

    constructor(props: EditFileProps) {
        super(props);
        this.state = {
            files: []
        };
        this.fileCompRef = createRef();
        this.oncePermissionRef = createRef();
    }

    componentDidMount = async () => {
        console.log();
    };

    update = async (): Promise<boolean> => {
        return false;
    };

    render = () => {
        if (!this.props.resourceIds || this.props.resourceIds.length === 0) return null;
        return (
            <div className="EditFile">
                <MetaEditor fileIds={this.props.resourceIds} />
            </div>
        );
    };
}

/*

<FilezFileViewer fileId={this.props.resourceIds[0]} />

What can be done on multiple files at once:
- Keywords
- storage
- owner 
- mime type
- download all of them at once
-  static groups
*/
