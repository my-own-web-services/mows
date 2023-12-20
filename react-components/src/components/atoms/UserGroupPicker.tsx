import { PureComponent } from "react";
import MultiItemTagPicker, {
    MultiItemTagPickerResources,
    TagData,
    resourcesToSelectionMap
} from "./MultiItemTagPicker";
import { FilezContext } from "../../FilezProvider";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import { InputPicker, TagPicker } from "rsuite";

interface UserGroupPickerProps {
    readonly mode: "single" | "multi" | "multimulti";
    readonly initialSingleSelectedValue?: string;
    readonly initialMultiSelectedValues?: string[];
    readonly multimultiResources?: FilezPermission[] | ReducedFilezUser[];

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

interface UserGroupPickerState {
    readonly knownTags: TagData[];
    readonly knownTagsLoaded: boolean;
    readonly resourceMap: MultiItemTagPickerResources;
    readonly singleSelectedValue?: string;
    readonly multiSelectedValues?: string[];
}

export default class UserGroupPicker extends PureComponent<
    UserGroupPickerProps,
    UserGroupPickerState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: UserGroupPickerProps) {
        super(props);
        this.state = {
            resourceMap: {},
            knownTagsLoaded: false,
            knownTags: [],
            singleSelectedValue: props.initialSingleSelectedValue,
            multiSelectedValues: props.initialMultiSelectedValues
        };
    }

    componentDidMount = async () => {
        const knownUsers = (await this.getKnownUsers()) ?? [];
        this.setState({ knownTags: knownUsers, knownTagsLoaded: true });
    };

    getKnownUsers = async () => {
        if (!this.context) return;
        const itemRes = await this.context.filezClient.list_user_groups();
        const knownTags: TagData[] = itemRes.items.map((it) => {
            return {
                label: it.name ?? undefined,
                value: it._id
            };
        });
        return knownTags;
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
            <div className="UserGroupPicker" style={this.props.style}>
                {(() => {
                    if (this.props.mode === "single") {
                        return (
                            <InputPicker
                                size={this.props.size ?? "md"}
                                disabled={this.props.disabled}
                                data={this.state.knownTags}
                                onSelect={this.onSingleSelect}
                                value={this.state.singleSelectedValue}
                                block
                            />
                        );
                    } else if (this.props.mode === "multi") {
                        return (
                            <TagPicker
                                data={this.state.knownTags}
                                onChange={this.onMultiChange}
                                value={this.state.multiSelectedValues}
                                block
                            />
                        );
                    } else if (this.props.mode === "multimulti") {
                        return (
                            <MultiItemTagPicker
                                possibleTags={this.state.knownTags}
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
