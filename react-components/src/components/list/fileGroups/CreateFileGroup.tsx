import { PureComponent, createRef } from "react";
import FileGroup from "./FileGroup";
import Permission from "../permissions/Permission";

interface CreateFileGroupProps {}

interface CreateFileGroupState {}

export default class CreateFileGroup extends PureComponent<
    CreateFileGroupProps,
    CreateFileGroupState
> {
    ref: React.RefObject<FileGroup>;
    oncePermissionRef: React.RefObject<Permission>;

    constructor(props: CreateFileGroupProps) {
        super(props);
        this.state = {};

        this.ref = createRef();
        this.oncePermissionRef = createRef();
    }

    create = async (): Promise<boolean> => {
        const createPermissionRes = await this.oncePermissionRef.current?.saveData();
        if (!createPermissionRes) return false;

        const res = await this.ref.current?.create(createPermissionRes);
        return res ? true : false;
    };

    render = () => {
        return (
            <div className="CreateFileGroup">
                <FileGroup oncePermissionRef={this.oncePermissionRef} ref={this.ref} />
            </div>
        );
    };
}
