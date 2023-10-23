import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import { PureComponent } from "react";
import { Input, SelectPicker, TagPicker } from "rsuite";
import { FilezContext } from "../../../FilezProvider";
import { Visibility } from "@firstdorsal/filez-client/dist/js/apiTypes/Visibility";

interface CreateUserGroupProps {}

interface CreateUserGroupState {
    readonly users: ReducedFilezUser[];
    readonly selectedUsers: string[];
    readonly name: string;
    readonly visibility: Visibility;
}

export default class CreateUserGroup extends PureComponent<
    CreateUserGroupProps,
    CreateUserGroupState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: CreateUserGroupProps) {
        super(props);
        this.state = {
            users: [],
            name: "",
            selectedUsers: [],
            visibility: "Private"
        };
    }

    componentDidMount = async () => {
        if (!this.context) return;
        const { items } = await this.context.filezClient.get_user_list({
            filter: "",
            from_index: 0,
            limit: null,
            sort_field: null,
            sort_order: null
        });
        this.setState({ users: items });
    };

    create = async (): Promise<boolean> => {
        if (!this.context) return false;
        const { name, visibility } = this.state;
        const res = await this.context.filezClient.create_user_group({
            name,
            visibility
        });
        if (res.status === 201) {
            return true;
        } else {
            return false;
        }
    };

    render = () => {
        return (
            <div className="CreateUserGroup">
                <label>Name</label>
                <Input
                    placeholder="A-Team"
                    value={this.state.name}
                    onChange={value => {
                        this.setState({ name: value });
                    }}
                />
                <br />
                <label>Visibility</label>
                <br />
                <SelectPicker
                    value={this.state.visibility}
                    onChange={value => {
                        this.setState({ visibility: (value ?? "Private") as Visibility });
                    }}
                    searchable={false}
                    data={["Public", "Private"].map(v => {
                        return { label: v, value: v };
                    })}
                />
                <br />
                <br />
                <label>Invite Members</label>
                <br />

                <TagPicker
                    style={{ width: "300px" }}
                    virtualized
                    value={this.state.selectedUsers}
                    onChange={value => {
                        this.setState({ selectedUsers: value });
                    }}
                    data={this.state.users.map(u => {
                        return { label: u.name, value: u._id };
                    })}
                />
            </div>
        );
    };
}
