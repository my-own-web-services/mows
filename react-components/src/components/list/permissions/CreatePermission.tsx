import { PureComponent, createRef } from "react";
import Permission from "../../metaEditor/Permission";

interface CreatePermissionProps {}

interface CreatePermissionState {}

export default class CreatePermission extends PureComponent<
    CreatePermissionProps,
    CreatePermissionState
> {
    permissionRef: React.RefObject<Permission>;

    constructor(props: CreatePermissionProps) {
        super(props);
        this.state = {};

        this.permissionRef = createRef();
    }

    create = async (): Promise<boolean> => {
        const res = await this.permissionRef.current?.saveData();
        return res ? true : false;
    };

    render = () => {
        return (
            <div className="CreatePermission">
                <Permission ref={this.permissionRef} disableSaveButton={true} />
            </div>
        );
    };
}
