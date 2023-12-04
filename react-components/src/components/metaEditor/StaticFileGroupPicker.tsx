import { PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";
import MultiItemTagPicker, { MultiItemTagPickerResources } from "./MultiItemTagPicker";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

interface StaticFileGroupPickerProps {
    readonly resources?: FilezFile[];
    readonly creatable?: boolean;
    readonly size?: "lg" | "md" | "sm" | "xs";
}

interface StaticFileGroupPickerState {
    readonly knownGroups: string[];
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
        const resourceMap = this.resourcesToSelectedGroups(this.props.resources);
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

    getStaticFileGroups = async () => {
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
        const staticGroups = res.items.flatMap(group => {
            if (group.readonly === false) {
                return [];
            } else {
                return [group._id];
            }
        });

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
                        this.setState({ knownGroups, resourceMap });
                    }}
                    size={this.props.size}
                />
            </div>
        );
    };
}
