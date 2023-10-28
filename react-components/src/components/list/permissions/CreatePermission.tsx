import { PureComponent, createRef } from "react";
import Permission from "./Permission";

interface CreatePermissionProps {}

interface CreatePermissionState {}

export default class CreatePermission extends PureComponent<
    CreatePermissionProps,
    CreatePermissionState
> {
    ref: React.RefObject<Permission>;

    constructor(props: CreatePermissionProps) {
        super(props);
        this.state = {};

        this.ref = createRef();
    }

    create = async (): Promise<boolean> => {
        const res = await this.ref.current?.saveData();
        return res ? true : false;
    };

    render = () => {
        return (
            <div className="CreatePermission">
                <Permission ref={this.ref} disableSaveButton={true} />
            </div>
        );
    };
}
