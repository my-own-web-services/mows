import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { UserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/UserGroup";
import ResourceList, { Column, ColumnDirection } from "../resource/ResourceList";
import CreateUserGroup from "./CreateUserGroup";
import EditUserGroup from "./EditUserGroup";
import { FilezUserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUserGroup";

const defaultColumns: Column<FilezUserGroup>[] = [
    {
        field: "name",
        alternateField: "_id",
        direction: ColumnDirection.ASCENDING,
        widthPercent: 33,
        minWidthPixels: 50
    },
    {
        field: "visibility",
        direction: ColumnDirection.NEUTRAL,
        widthPercent: 33,
        minWidthPixels: 50,
        render: (item: FilezUserGroup) => {
            return <span>{item.visibility}</span>;
        }
    }
];

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
                    columns={defaultColumns}
                    resourceType="UserGroup"
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.get_user_group_list}
                    displayTopBar={this.props.displayTopBar}
                />
            </div>
        );
    };
}
