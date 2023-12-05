import { PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";
import MultiItemTagPicker, { MultiItemTagPickerResources, TagData } from "./MultiItemTagPicker";
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
                return await this.context?.filezClient?.get_file_infos(this.props.resourceIds);
            } else {
                return false;
            }
        })();

        if (!resources) return;

        const resourceMap = this.resourcesToSelectedGroups(resources);
        const knownGroups = await this.getStaticFileGroups();

        console.log("StaticFileGroupPicker", { resourceMap, knownGroups });

        this.setState({ resourceMap, knownGroups: knownGroups ?? [], knownGroupsLoaded: true });
    };

    resourcesToSelectedGroups = (resources?: FilezFile[]) => {
        const selectedGroupsMap: MultiItemTagPickerResources = {};
        resources?.forEach(resource => {
            selectedGroupsMap[resource._id] = resource.static_file_group_ids;
        });
        return selectedGroupsMap;
    };

    getStaticFileGroups = async (): Promise<TagData[] | null> => {
        if (!this.context) return null;
        const res = await this.context.filezClient.get_own_file_groups(
            {
                filter: "",
                from_index: 0,
                limit: null,
                sort_field: null,
                sort_order: null
            },
            "Static"
        );
        const staticGroups: TagData[] = res.items.map(group => ({
            label: group.name ?? undefined,
            value: group._id,
            readonly: group.readonly
        }));

        return staticGroups;
    };

    render = () => {
        if (!this.state.knownGroupsLoaded) return;

        return (
            <div className="StaticFileGroupPicker">
                <MultiItemTagPicker
                    multiItemSelectedTags={this.state.resourceMap}
                    possibleTags={this.state.knownGroups}
                    onChange={(resourceMap, knownGroups) => {
                        if (this.props.serverUpdate !== false) {
                            for (const [resourceId, static_file_group_ids] of Object.entries(
                                resourceMap
                            )) {
                                this.context?.filezClient.update_file_infos(resourceId, {
                                    static_file_group_ids
                                });
                            }
                        }
                        this.props.onChange?.(resourceMap, knownGroups);
                        this.setState({ knownGroups, resourceMap });
                    }}
                    size={this.props.size}
                />
            </div>
        );
    };
}
