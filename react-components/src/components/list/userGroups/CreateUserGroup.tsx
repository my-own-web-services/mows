import { PureComponent, createRef } from "react";
import UserGroup from "./UserGroup";

interface CreateUserGroupProps {}

interface CreateUserGroupState {}

export default class CreateUserGroup extends PureComponent<
    CreateUserGroupProps,
    CreateUserGroupState
> {
    ref: React.RefObject<UserGroup>;

    constructor(props: CreateUserGroupProps) {
        super(props);
        this.state = {};
        this.ref = createRef();
    }

    create = async (): Promise<boolean> => {
        const res = await this.ref.current?.create();
        return res ? true : false;
    };

    render = () => {
        return (
            <div className="CreateUserGroup">
                <UserGroup ref={this.ref} />
            </div>
        );
    };
}
