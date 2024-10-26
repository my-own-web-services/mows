import { PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";
import MultiItemTagPicker, {
    MultiItemTagPickerResources,
    TagData,
    resourcesToSelectionMap
} from "./MultiItemTagPicker";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

interface StaticFileGroupPickerProps {
    /**
     * You can provide the resources instead of the resourceIds to load them from the server
     */
    readonly resources?: FilezFile[];
    /**
     * You can provide the resourceIds instead of the resources to load them from the server
     */
    readonly resourceIds?: string[];
    /**
     * Whether to allow creating new groups with this picker
     */
    readonly creatable?: boolean;
    /**
     * @default "md"
     */
    readonly size?: "lg" | "md" | "sm" | "xs";
    /**
     * Called when the user changes the selection of groups
     */
    readonly onChange?: (
        newResources: MultiItemTagPickerResources,
        possibleTags: TagData[]
    ) => void;
    /**
     * Whether the component should handle the server update of the resources
     */
    readonly serverUpdate?: boolean;
}

interface StaticFileGroupPickerState {
    readonly knownGroups: TagData[];
    readonly knownGroupsLoaded: boolean;
    readonly resourceMap: MultiItemTagPickerResources;
}

export default class StaticFileGroupPicker extends PureComponent<
    StaticFileGroupPickerProps,
    StaticFileGroupPickerState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: StaticFileGroupPickerProps) {
        super(props);
        this.state = {
            resourceMap: {},
            knownGroupsLoaded: false,
            knownGroups: []
        };
    }

    componentDidMount = async () => {
        const resources = await (async () => {
            if (this.props.resources) {
                return this.props.resources;
            } else if (this.props.resourceIds) {
                return await this.context?.filezClient?.get_file_infos(
                    this.props.resourceIds
                );
            } else {
                return false;
            }
        })();

        if (resources === false || resources === undefined)
            throw new Error("No resources provided");

        const resourceMap = resourcesToSelectionMap(
            resources,
            "static_file_group_ids"
        );
        const knownGroups = await this.getStaticFileGroups();

        this.setState({
            resourceMap,
            knownGroups: knownGroups ?? [],
            knownGroupsLoaded: true
        });
    };

    getStaticFileGroups = async (): Promise<TagData[] | null> => {
        if (!this.context) return null;
        const res = await this.context.filezClient.list_file_groups({
            sub_resource_type: "Static"
        });
        const staticGroups: TagData[] = res.items.map((group) => ({
            label: group.name ?? undefined,
            value: group._id,
            readonly: group.readonly
        }));

        return staticGroups;
    };

    onChange = async (
        resourceMap: MultiItemTagPickerResources,
        knownGroups: TagData[]
    ) => {
        this.setState({ knownGroups, resourceMap });

        if (this.props.serverUpdate !== false) {
            const res = await this.context?.filezClient.update_file_infos({
                data: {
                    StaticFileGroupsIds: Object.entries(resourceMap).map(
                        ([file_id, static_file_group_ids]) => ({
                            file_id,
                            field: static_file_group_ids
                        })
                    )
                }
            });
            if (res?.status === 200) {
                this.props.onChange?.(resourceMap, knownGroups);
            }
        } else {
            this.props.onChange?.(resourceMap, knownGroups);
        }
    };

    render = () => {
        if (!this.state.knownGroupsLoaded) return;

        return (
            <div className="StaticFileGroupPicker">
                <MultiItemTagPicker
                    multiItemSelectedTags={this.state.resourceMap}
                    possibleTags={this.state.knownGroups}
                    onChange={this.onChange}
                    size={this.props.size}
                />
            </div>
        );
    };
}
