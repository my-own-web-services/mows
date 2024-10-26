import { PureComponent } from "react";
import MultiItemTagPicker, {
    MultiItemTagPickerResources,
    TagData,
    resourcesToSelectionMap
} from "./MultiItemTagPicker";
import { FilezContext } from "../../FilezProvider";
import { FilezUserGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUserGroup";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import { InputPicker, TagPicker } from "rsuite";

interface UserPickerProps {
    readonly mode: "single" | "multi" | "multimulti";
    readonly initialSingleSelectedValue?: string;
    readonly initialMultiSelectedValues?: string[];
    readonly multimultiResources?:
        | FilezUserGroup[]
        | FilezPermission[]
        | ReducedFilezUser[];

    readonly multimultiSelectField?: string;
    /**
     * @default "md"
     */
    readonly size?: "lg" | "md" | "sm" | "xs";
    readonly disabled?: boolean;
    readonly style?: React.CSSProperties;

    /**
     * Called when the user changes the selection of users
     */
    readonly onSingleSelect?: (selectedUserId: string) => void;
    readonly onMultiChange?: (selectedUserIds: string[]) => void;
    readonly onMultiMultiChange?: (
        resources: MultiItemTagPickerResources
    ) => void;
}

interface UserPickerState {
    readonly knownUsers: TagData[];
    readonly knownUsersLoaded: boolean;
    readonly resourceMap: MultiItemTagPickerResources;
    readonly singleSelectedValue?: string;
    readonly multiSelectedValues?: string[];
}

export default class UserPicker extends PureComponent<
    UserPickerProps,
    UserPickerState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: UserPickerProps) {
        super(props);
        this.state = {
            resourceMap: {},
            knownUsersLoaded: false,
            knownUsers: [],
            singleSelectedValue: props.initialSingleSelectedValue,
            multiSelectedValues: props.initialMultiSelectedValues
        };
    }

    componentDidMount = async () => {
        const knownUsers = (await this.getKnownUsers()) ?? [];
        this.setState({ knownUsers, knownUsersLoaded: true });
    };

    getKnownUsers = async () => {
        if (!this.context) return;
        const usersRes = await this.context.filezClient.list_users();
        const knownUsers: TagData[] = usersRes.items.map((user) => {
            return {
                label: user.name ?? undefined,
                value: user._id
            };
        });
        return knownUsers;
    };

    onMultiMultiChange = (resources: MultiItemTagPickerResources) => {
        this.props.onMultiMultiChange?.(resources);
    };

    onSingleSelect = (selectedUserId: string) => {
        this.setState({ singleSelectedValue: selectedUserId });
        this.props.onSingleSelect?.(selectedUserId);
    };

    onMultiChange = (selectedUserIds: string[]) => {
        this.setState({ multiSelectedValues: selectedUserIds });
        this.props.onMultiChange?.(selectedUserIds);
    };

    render = () => {
        return (
            <div className="UserPicker" style={this.props.style}>
                {(() => {
                    if (this.props.mode === "single") {
                        return (
                            <InputPicker
                                size={this.props.size ?? "md"}
                                disabled={this.props.disabled}
                                data={this.state.knownUsers}
                                onSelect={this.onSingleSelect}
                                value={this.state.singleSelectedValue}
                                block
                            />
                        );
                    } else if (this.props.mode === "multi") {
                        return (
                            <TagPicker
                                data={this.state.knownUsers}
                                onChange={this.onMultiChange}
                                value={this.state.multiSelectedValues}
                                block
                            />
                        );
                    } else if (this.props.mode === "multimulti") {
                        return (
                            <MultiItemTagPicker
                                possibleTags={this.state.knownUsers}
                                onChange={this.onMultiMultiChange}
                                creatable={false}
                                multiItemSelectedTags={resourcesToSelectionMap(
                                    //@ts-ignore
                                    this.props.multimultiResources ?? [],
                                    this.props.multimultiSelectField
                                )}
                            />
                        );
                    }
                })()}
            </div>
        );
    };
}
