import { PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import UserGroup from "./UserGroup";
import { FilezUserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUserGroup";
import Permission from "../permissions/Permission";

interface EditUserGroupProps {
    readonly resourceIds?: string[];
}

interface EditUserGroupState {
    readonly userGroups: FilezUserGroup[];
}

export default class EditUserGroup extends PureComponent<
    EditUserGroupProps,
    EditUserGroupState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    userGroupRef: React.RefObject<UserGroup>;
    oncePermissionRef: React.RefObject<Permission>;

    constructor(props: EditUserGroupProps) {
        super(props);
        this.state = {
            userGroups: []
        };
        this.userGroupRef = createRef();
        this.oncePermissionRef = createRef();
    }

    componentDidMount = async () => {
        if (!this.context) return;

        const { items } = await this.context.filezClient.get_user_group_list({
            sort_field: "name"
        });

        const userGroups = items.filter((item) => {
            return this.props.resourceIds?.includes(item._id) ?? false;
        });

        this.setState({ userGroups });
    };

    update = async (): Promise<boolean> => {
        const useOncePermissionId =
            await this.oncePermissionRef?.current?.saveData();
        const res = await this.userGroupRef.current?.update(
            useOncePermissionId
        );
        return typeof res === "string";
    };

    render = () => {
        if (this.state.userGroups?.[0] === undefined) return null;
        return (
            <div className="EditUserGroup">
                <UserGroup
                    oncePermissionRef={this.oncePermissionRef}
                    group={this.state.userGroups[0]}
                    ref={this.userGroupRef}
                />
            </div>
        );
    };
}
