import { cloneDeep } from "lodash";
import { Component } from "react";
import { Checkbox, TagPicker, Tag } from "rsuite";
import CheckIcon from "@rsuite/icons/Check";

export interface Category {
    name: string;
    render: (tag: string) => JSX.Element;
}

interface MultiItemTagPickerProps {
    readonly size?: "lg" | "md" | "sm" | "xs";
    readonly multiItemSelectedTags: MultiItemTagPickerResources;
    readonly possibleTags: string[];
    readonly onChange: (newResources: MultiItemTagPickerResources, possibleTags: string[]) => void;
    readonly disabled?: boolean;
    readonly knownCategories?: Category[];
}

interface MultiItemTagPickerState {
    readonly selectedTags: string[];
    readonly halfCheckedTags: HalfCheckedMap;
    readonly data: TagData[];
}

export interface HalfCheckedMap {
    [tag: string]: boolean;
}

export interface MultiItemTagPickerResources {
    [resourceId: string]: string[];
}

interface TagData {
    label: string | JSX.Element;
    value: string;
    category: string;
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
            data: [],
            halfCheckedTags: {}
        };
    }

    componentDidMount = async () => {
        this.setState({ ...this.resourcesToData(this.props.multiItemSelectedTags) });
    };

    componentDidUpdate = async (prevProps: MultiItemTagPickerProps) => {
        if (prevProps.multiItemSelectedTags !== this.props.multiItemSelectedTags) {
            this.setState({ ...this.resourcesToData(this.props.multiItemSelectedTags) });
        }
    };

    resourcesToData = (resourceMap: MultiItemTagPickerResources) => {
        const data: TagData[] = [];
        const selectedTags: string[] = [];
        const halfCheckedTags: HalfCheckedMap = {};

        const resourceArray = Object.entries(resourceMap);

        for (const tag of this.props.possibleTags) {
            const resourcesWithCurrentTag = resourceArray.filter(([_, resourceTags]) =>
                resourceTags.includes(tag)
            ).length;

            const tagState: TagState = (() => {
                if (resourcesWithCurrentTag === 0) return TagState.None;
                if (resourcesWithCurrentTag === resourceArray.length) return TagState.All;
                return TagState.Some;
            })();

            if (tagState !== TagState.None) selectedTags.push(tag);
            //@ts-ignore
            halfCheckedTags[tag] = tagState === TagState.Some ? true : false;
            data.push({
                label: (() => {
                    if (tag.includes(">")) {
                        const currentCategory = tag.split(">")[0];

                        const foundKnownCategory = this.props.knownCategories?.find(
                            c => c.name === currentCategory
                        );

                        if (foundKnownCategory) {
                            return foundKnownCategory.render(tag);
                        }
                    }
                    return tag;
                })(),
                value: tag,
                category: tag.includes(">") ? tag.split(">")[0] : "Other"
            });
        }

        //data.sort((a, b) => a.value.localeCompare(b.value));

        return { data, selectedTags, halfCheckedTags };
    };

    onSelect = (selectedTags: string[], item: any) => {
        //item is InputItemDataType

        const switchedToSelected = !this.state.selectedTags.includes(item?.value);

        const newResources: MultiItemTagPickerResources = cloneDeep(
            this.props.multiItemSelectedTags
        );
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
        const newResources: MultiItemTagPickerResources = cloneDeep(
            this.props.multiItemSelectedTags
        );
        for (const [resourceId, currentTags] of Object.entries(newResources)) {
            newResources[resourceId] = [...currentTags, item?.value];
        }
        this.props.onChange(newResources, [...this.props.possibleTags, item?.value]);
    };

    onTagRemove = (removedTagValue: string) => {
        const newResources: MultiItemTagPickerResources = cloneDeep(
            this.props.multiItemSelectedTags
        );
        for (const [resourceId, _] of Object.entries(newResources)) {
            newResources[resourceId] = newResources[resourceId].filter(
                tag => tag !== removedTagValue
            );
        }
        this.props.onChange(newResources, this.props.possibleTags);
    };

    onTagCheck = (checkedTagValue: string) => {
        const newResources: MultiItemTagPickerResources = cloneDeep(
            this.props.multiItemSelectedTags
        );
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
                    trigger={["Enter"]}
                    data={this.state.data}
                    value={this.state.selectedTags}
                    size={this.props.size}
                    onSelect={this.onSelect}
                    onCreate={this.onCreate}
                    onTagRemove={this.onTagRemove}
                    cleanable={false}
                    disabled={this.props.disabled}
                    groupBy="category"
                    creatable
                    virtualized
                    block
                    renderMenuItemCheckbox={(checkboxProps: any) => {
                        const { value, checked, children, ...restProps } = checkboxProps;

                        const indeterminate = this.state.halfCheckedTags[value];

                        return (
                            <Checkbox
                                value={value}
                                checked={checked}
                                {...restProps}
                                indeterminate={indeterminate}
                            >
                                {children}
                                {indeterminate && " *"}
                            </Checkbox>
                        );
                    }}
                    renderValue={(values: string[], items: any, selectedElement: any) => {
                        return values.map((tag, index) => {
                            const indeterminate = this.state.halfCheckedTags[tag];

                            const label = items?.find((item: any) => item?.value === tag)?.label;

                            return (
                                <Tag
                                    key={index}
                                    closable={true}
                                    onClose={e => {
                                        e.stopPropagation();
                                        this.onTagRemove(tag);
                                    }}
                                >
                                    {label}
                                    {indeterminate && " *"}
                                    {indeterminate && (
                                        <span
                                            style={{
                                                paddingRight: "3px",
                                                paddingLeft: "5px",
                                                cursor: "pointer"
                                            }}
                                            className="CheckIconButton"
                                        >
                                            <CheckIcon
                                                style={{}}
                                                onClick={e => {
                                                    this.onTagCheck(tag);
                                                }}
                                            />
                                        </span>
                                    )}
                                </Tag>
                            );
                        });
                    }}
                />
            </div>
        );
    };
}
