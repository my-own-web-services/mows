import { PureComponent, createRef } from "react";
import Permission from "../permissions/Permission";
import UploadFile from "./UploadFile";

interface CreateFileProps {}

interface CreateFileState {}

export default class CreateFile extends PureComponent<CreateFileProps, CreateFileState> {
    fileRef: React.RefObject<UploadFile>;
    oncePermissionRef: React.RefObject<Permission>;
    constructor(props: CreateFileProps) {
        super(props);
        this.state = {};
        this.fileRef = createRef();
        this.oncePermissionRef = createRef();
    }

    create = async (): Promise<boolean> => {
        const useOncePermissionId = await this.oncePermissionRef?.current?.saveData();

        const res = await this.fileRef.current?.create(useOncePermissionId);
        return res ? true : false;
    };

    render = () => {
        return (
            <div className="CreateFile">
                <UploadFile
                    oncePermissionRef={this.oncePermissionRef}
                    ref={this.fileRef}
                    type="create"
                />
            </div>
        );
    };
}
