import { cloneDeep } from "lodash";
import { Component } from "react";
import { Checkbox, TagPicker, Tag } from "rsuite";
import CheckIcon from "@rsuite/icons/Check";
import { ItemDataType } from "rsuite/esm/@types/common";

export interface Category {
    name: string;
    render: (tag: string) => JSX.Element;
}

interface MultiItemTagPickerProps {
    /**
     * @default "md"
     * The Size of the input
     */
    readonly size?: "lg" | "md" | "sm" | "xs";
    readonly style?: React.CSSProperties;
    readonly multiItemSelectedTags: MultiItemTagPickerResources;
    readonly possibleTags: TagData[];
    readonly onChange?: (
        newResources: MultiItemTagPickerResources,
        possibleTags: TagData[]
    ) => void;
    readonly onCreate?: (
        newResources: MultiItemTagPickerResources,
        possibleTags: TagData[]
    ) => void;
    readonly disabled?: boolean;
    readonly knownCategories?: Category[];
    readonly creatable?: boolean;
}

interface MultiItemTagPickerState {
    readonly selectedTags: string[];
    readonly halfCheckedTags: HalfCheckedMap;
    readonly data: InternalTagData[];
}

export interface HalfCheckedMap {
    [tag: string]: boolean;
}

export interface MultiItemTagPickerResources {
    [resourceId: string]: string[];
}

export interface TagData {
    value: string;
    label?: string;
    readonly?: boolean;
}

interface InternalTagData {
    label: string | JSX.Element;
    value: string;
    category: string;
    readonly?: boolean;
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
        this.setState({
            ...this.resourcesToData(this.props.multiItemSelectedTags)
        });
    };

    componentDidUpdate = async (prevProps: MultiItemTagPickerProps) => {
        if (
            prevProps.multiItemSelectedTags !== this.props.multiItemSelectedTags
        ) {
            this.setState({
                ...this.resourcesToData(this.props.multiItemSelectedTags)
            });
        }
    };

    resourcesToData = (resourceMap: MultiItemTagPickerResources) => {
        const data: InternalTagData[] = [];
        const selectedTags: string[] = [];
        const halfCheckedTags: HalfCheckedMap = {};

        const resourceArray = Object.entries(resourceMap);

        for (const { value, label, readonly } of this.props.possibleTags) {
            const resourcesWithCurrentTag = resourceArray.filter(
                ([_, resourceTags]) => resourceTags?.includes(value)
            ).length;

            const tagState: TagState = (() => {
                if (resourcesWithCurrentTag === 0) return TagState.None;
                if (resourcesWithCurrentTag === resourceArray.length)
                    return TagState.All;
                return TagState.Some;
            })();

            if (tagState !== TagState.None) selectedTags.push(value);

            halfCheckedTags[value] = tagState === TagState.Some ? true : false;

            data.push({
                label: (() => {
                    if (value.includes(">")) {
                        const currentCategory = value.split(">")[0];

                        const foundKnownCategory =
                            this.props.knownCategories?.find(
                                (c) => c.name === currentCategory
                            );

                        if (foundKnownCategory) {
                            return foundKnownCategory.render(value);
                        }
                    }
                    return label ?? value;
                })(),
                value: value,
                category: value.includes(">") ? value.split(">")[0] : "Other",
                readonly
            });
        }

        //data.sort((a, b) => a.value.localeCompare(b.value));

        return { data, selectedTags, halfCheckedTags };
    };

    onSelect = (_selectedTags: string[], item: ItemDataType) => {
        //item is InputItemDataType

        let itemValue;

        if (typeof item.value === "string") {
            itemValue = item.value;
        } else if (typeof item.value === "number") {
            itemValue = item.value.toString();
        } else {
            throw new Error("item.value is not string or number");
        }

        const switchedToSelected = !this.state.selectedTags.includes(itemValue);

        const newResources: MultiItemTagPickerResources = cloneDeep(
            this.props.multiItemSelectedTags
        );
        for (const [resourceId, currentTags] of Object.entries(newResources)) {
            if (switchedToSelected || item?.indeterminate === true) {
                newResources[resourceId] = [...currentTags, itemValue];
            } else {
                newResources[resourceId] = newResources[resourceId].filter(
                    (tag) => tag !== item?.value
                );
            }
        }
        this.props.onChange?.(newResources, this.props.possibleTags);
    };

    onCreate = (_newTag: string, item: TagData) => {
        const newResources: MultiItemTagPickerResources = cloneDeep(
            this.props.multiItemSelectedTags
        );
        for (const [resourceId, currentTags] of Object.entries(newResources)) {
            newResources[resourceId] = [...currentTags, item?.value];
        }
        this.props.onCreate?.(newResources, [...this.props.possibleTags, item]);
    };

    onTagRemove = (removedTagValue: string) => {
        const newResources: MultiItemTagPickerResources = cloneDeep(
            this.props.multiItemSelectedTags
        );
        for (const [resourceId, _] of Object.entries(newResources)) {
            newResources[resourceId] = newResources[resourceId].filter(
                (tag) => tag !== removedTagValue
            );
        }
        this.props.onChange?.(newResources, this.props.possibleTags);
    };

    onTagCheck = (checkedTagValue: string) => {
        const newResources: MultiItemTagPickerResources = cloneDeep(
            this.props.multiItemSelectedTags
        );
        for (const [resourceId, currentTags] of Object.entries(newResources)) {
            if (!currentTags.includes(checkedTagValue)) {
                newResources[resourceId] = [...currentTags, checkedTagValue];
            }
        }
        this.props.onChange?.(newResources, this.props.possibleTags);
    };

    renderMenuItemCheckbox = (checkboxProps: any) => {
        const { value, checked, children, ...restProps } = checkboxProps;

        const indeterminate = this.state.halfCheckedTags[value];

        const readonly = this.props.possibleTags.find(
            (tag) => tag.value === value
        )?.readonly;

        return (
            <Checkbox
                readOnly={readonly}
                disabled={readonly}
                value={value}
                checked={checked}
                {...restProps}
                indeterminate={indeterminate}
            >
                {children}
                {indeterminate && " *"}
            </Checkbox>
        );
    };

    renderValue = (values: string[], items: InternalTagData[]) => {
        return values.map((tag, index) => {
            const indeterminate = this.state.halfCheckedTags[tag];

            const item = items?.find((it: any) => it?.value === tag);

            return (
                <Tag
                    key={index}
                    closable={item?.readonly === true ? false : true}
                    onClose={(e) => {
                        e.stopPropagation();
                        this.onTagRemove(tag);
                    }}
                >
                    {item?.label}
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
                                title="Apply to all"
                                style={{}}
                                onClick={() => {
                                    this.onTagCheck(tag);
                                }}
                            />
                        </span>
                    )}
                </Tag>
            );
        });
    };

    render = () => {
        // TODO when Comma is used as trigger and a tag is selected, the tag is removed
        return (
            <TagPicker
                style={this.props.style}
                trigger={["Enter"]}
                data={this.state.data}
                value={this.state.selectedTags}
                size={this.props.size}
                onSelect={this.onSelect}
                //@ts-ignore
                onCreate={this.onCreate}
                onTagRemove={this.onTagRemove}
                cleanable={false}
                disabled={this.props.disabled}
                groupBy={this.props.knownCategories && "category"}
                creatable={this.props.creatable ?? false}
                virtualized
                block
                renderMenuItemCheckbox={this.renderMenuItemCheckbox}
                //@ts-ignore
                renderValue={this.renderValue}
            />
        );
    };
}

export const resourcesToSelectionMap = <Resource,>(
    resources: Resource[],
    field_id: string
) => {
    const selectedGroupsMap: MultiItemTagPickerResources = {};
    resources?.forEach((resource) => {
        // @ts-ignore
        selectedGroupsMap[resource._id] = resource[field_id];
    });
    return selectedGroupsMap;
};
