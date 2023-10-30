import { PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import UserGroup from "./UserGroup";
import { FilezUserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUserGroup";

interface EditUserGroupProps {
    readonly resourceIds?: string[];
}

interface EditUserGroupState {
    readonly userGroups: FilezUserGroup[];
}

export default class EditUserGroup extends PureComponent<EditUserGroupProps, EditUserGroupState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    ref: React.RefObject<UserGroup>;

    constructor(props: EditUserGroupProps) {
        super(props);
        this.state = {
            userGroups: []
        };
        this.ref = createRef();
    }

    componentDidMount = async () => {
        if (!this.context) return;

        const { items } = await this.context.filezClient.get_user_group_list({
            filter: "",
            from_index: 0,
            limit: null,
            sort_field: "name",
            sort_order: "Ascending"
        });

        const fileGroups = items.filter(item => {
            return this.props.resourceIds?.includes(item._id) ?? false;
        });

        this.setState({ userGroups: fileGroups });
    };

    update = async (): Promise<boolean> => {
        const res = await this.ref.current?.update();
        return res ? true : false;
    };

    render = () => {
        if (!this.state.userGroups[0]) return null;
        return (
            <div className="EditUserGroup">
                <UserGroup group={this.state.userGroups[0]} ref={this.ref} />
            </div>
        );
    };
}
