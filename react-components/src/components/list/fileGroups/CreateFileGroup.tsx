import { PureComponent, createRef } from "react";
import FileGroup from "./FileGroup";
import Permission from "../permissions/Permission";

interface CreateFileGroupProps {}

interface CreateFileGroupState {}

export default class CreateFileGroup extends PureComponent<
    CreateFileGroupProps,
    CreateFileGroupState
> {
    fileGroupRef: React.RefObject<FileGroup>;
    oncePermissionRef: React.RefObject<Permission>;

    constructor(props: CreateFileGroupProps) {
        super(props);
        this.state = {};

        this.fileGroupRef = createRef();
        this.oncePermissionRef = createRef();
    }

    create = async (): Promise<boolean> => {
        const useOncePermissionId =
            await this.oncePermissionRef?.current?.saveData();

        const res = await this.fileGroupRef.current?.create(
            useOncePermissionId
        );
        return typeof res === "string";
    };

    render = () => {
        return (
            <div className="CreateFileGroup">
                <FileGroup
                    oncePermissionRef={this.oncePermissionRef}
                    ref={this.fileGroupRef}
                />
            </div>
        );
    };
}
