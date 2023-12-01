import { cloneDeep } from "lodash";
import { Component } from "react";
import { Checkbox, TagPicker } from "rsuite";

interface MultiItemTagPickerProps {
    readonly size?: "lg" | "md" | "sm" | "xs";
    readonly resources: MultiItemTagPickerResources;
    readonly possibleTags: string[];
    readonly onChange: (newResources: MultiItemTagPickerResources, possibleTags: string[]) => void;
}

interface MultiItemTagPickerState {
    readonly selectedTags: string[];
    readonly data: TagData[];
}

export interface MultiItemTagPickerResources {
    [resourceId: string]: string[];
}

interface TagData {
    label: string;
    value: string;
    indeterminate: boolean;
}

enum TagState {
    All,
    None,
    Some
}

export default class MultiItemTagPicker extends Component<
    MultiItemTagPickerProps,
    MultiItemTagPickerState
> {
    constructor(props: MultiItemTagPickerProps) {
        super(props);
        this.state = {
            selectedTags: [],
            data: []
        };
    }

    componentDidMount = async () => {
        const { data, selectedTags } = this.resourcesToData(this.props.resources);
        this.setState({ data, selectedTags });
    };

    componentDidUpdate = async (prevProps: MultiItemTagPickerProps) => {
        if (prevProps.resources !== this.props.resources) {
            const { data, selectedTags } = this.resourcesToData(this.props.resources);
            this.setState({ data, selectedTags });
        }
    };

    resourcesToData = (resourceMap: MultiItemTagPickerResources) => {
        const data: TagData[] = [];
        const selectedTags: string[] = [];

        const resourceArray = Object.entries(resourceMap);

        for (const tag of this.props.possibleTags) {
            const resourcesWithCurrentTag = resourceArray.filter(([resourceId, resourceTags]) =>
                resourceTags.includes(tag)
            ).length;

            const tagState: TagState = (() => {
                if (resourcesWithCurrentTag === 0) return TagState.None;
                if (resourcesWithCurrentTag === resourceArray.length) return TagState.All;
                return TagState.Some;
            })();

            if (tagState !== TagState.None) selectedTags.push(tag);

            data.push({
                label: `${tag}${tagState === TagState.Some ? " *" : ""}`,
                value: tag,
                indeterminate: tagState === TagState.Some ? true : false
            });
        }

        //data.sort((a, b) => a.value.localeCompare(b.value));

        return { data, selectedTags };
    };

    onSelect = (selectedTags: string[], item: any) => {
        //item is InputItemDataType

        const switchedToSelected = !this.state.selectedTags.includes(item?.value);
        console.log(switchedToSelected);

        const newResources: MultiItemTagPickerResources = cloneDeep(this.props.resources);
        for (const [resourceId, currentTags] of Object.entries(newResources)) {
            if (switchedToSelected || item?.indeterminate) {
                newResources[resourceId] = [...currentTags, item?.value];
            } else {
                newResources[resourceId] = newResources[resourceId].filter(
                    tag => tag !== item?.value
                );
            }
        }
        this.props.onChange(newResources, this.props.possibleTags);
    };

    onCreate = (newTag: string, item: any) => {
        const newResources: MultiItemTagPickerResources = cloneDeep(this.props.resources);
        for (const [resourceId, currentTags] of Object.entries(newResources)) {
            newResources[resourceId] = [...currentTags, item?.value];
        }
        this.props.onChange(newResources, [...this.props.possibleTags, item?.value]);
    };

    onTagRemove = (removedTagValue: string) => {
        const newResources: MultiItemTagPickerResources = cloneDeep(this.props.resources);
        for (const [resourceId, currentTags] of Object.entries(newResources)) {
            newResources[resourceId] = newResources[resourceId].filter(
                tag => tag !== removedTagValue
            );
        }
        this.props.onChange(newResources, this.props.possibleTags);
    };

    onTagCheck = (checkedTagValue: string) => {
        const newResources: MultiItemTagPickerResources = cloneDeep(this.props.resources);
        for (const [resourceId, currentTags] of Object.entries(newResources)) {
            newResources[resourceId] = [...currentTags, checkedTagValue];
        }
        this.props.onChange(newResources, this.props.possibleTags);
    };

    render = () => {
        // TODO when Comma is used as trigger and a tag is selected, the tag is removed
        return (
            <div className="MultiItemTagPicker">
                <TagPicker
                    trigger={["Enter", "Comma"]}
                    data={this.state.data}
                    value={this.state.selectedTags}
                    size={this.props.size}
                    onSelect={this.onSelect}
                    onCreate={this.onCreate}
                    onTagRemove={this.onTagRemove}
                    onTagCheck={this.onTagCheck}
                    renderMenuItemCheckbox={<Checkbox indeterminate />}
                    cleanable={false}
                    creatable
                    virtualized
                />
                <TagPicker
                    data={this.state.data}
                    value={this.state.selectedTags}
                    renderMenuItemCheckbox={<Checkbox indeterminate />}
                />
            </div>
        );
    };
}
