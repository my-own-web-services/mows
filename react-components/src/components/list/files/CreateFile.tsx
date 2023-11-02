import { PureComponent, createRef } from "react";
import File from "./File";
import Permission from "../permissions/Permission";

interface CreateFileProps {}

interface CreateFileState {}

export default class CreateFile extends PureComponent<CreateFileProps, CreateFileState> {
    fileRef: React.RefObject<File>;
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
                <File oncePermissionRef={this.oncePermissionRef} ref={this.fileRef} />
            </div>
        );
    };
}
