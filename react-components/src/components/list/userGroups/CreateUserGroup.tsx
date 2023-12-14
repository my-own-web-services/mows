import { PureComponent, createRef } from "react";
import UserGroup from "./UserGroup";
import Permission from "../permissions/Permission";

interface CreateUserGroupProps {}

interface CreateUserGroupState {}

export default class CreateUserGroup extends PureComponent<
    CreateUserGroupProps,
    CreateUserGroupState
> {
    userGroupRef: React.RefObject<UserGroup>;
    oncePermissionRef: React.RefObject<Permission>;

    constructor(props: CreateUserGroupProps) {
        super(props);
        this.state = {};
        this.userGroupRef = createRef();
        this.oncePermissionRef = createRef();
    }

    create = async (): Promise<boolean> => {
        const useOncePermissionId =
            await this.oncePermissionRef?.current?.saveData();
        const res = await this.userGroupRef.current?.create(
            useOncePermissionId
        );
        return typeof res === "string";
    };

    render = () => {
        return (
            <div className="CreateUserGroup">
                <UserGroup
                    oncePermissionRef={this.oncePermissionRef}
                    ref={this.userGroupRef}
                />
            </div>
        );
    };
}
