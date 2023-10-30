import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { UserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/UserGroup";
import ResourceList from "../resource/ResourceList";
import CreateUserGroup from "./CreateUserGroup";
import EditUserGroup from "./EditUserGroup";

interface UserGroupListProps {
    readonly rowRenderer?: (user: UserGroup, style: CSSProperties) => JSX.Element;
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
}

interface UserGroupListState {}

export default class UserGroupList extends PureComponent<UserGroupListProps, UserGroupListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: UserGroupListProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        if (!this.context) return null;
        return (
            <div className="Filez UserGroupList" style={{ ...this.props.style }}>
                <ResourceList
                    createResource={<CreateUserGroup />}
                    editResource={<EditUserGroup />}
                    resourceType="UserGroup"
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.get_user_group_list}
                    displayTopBar={this.props.displayTopBar}
                />
            </div>
        );
    };
}
