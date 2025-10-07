import { cn } from "@/lib/utils";
import { TagResourceType } from "filez-client-typescript";
import { TagIcon, Text } from "lucide-react";
import { PureComponent, type CSSProperties } from "react";
import { match } from "ts-pattern";
import { Textarea } from "../ui/textarea";
import ButtonSelect from "./ButtonSelect";

export interface ResourceTagsChangeset {
    resourceIds: string[];
    remove: { key: string; value: string }[];
    add: { key: string; value: string }[];
    resourceType: TagResourceType;
}

export interface ResourceTagsMap {
    [resourceId: string]: { key: string; value: string }[];
}

export interface ResourceTagsProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly onCommit?: (changes: ResourceTagsChangeset) => void;
    readonly tagsMap: ResourceTagsMap;
    readonly resourceType: TagResourceType;
}

export type PickerMode = "Badges" | "Text";

export interface ResourceTagsState {
    readonly pickerMode: PickerMode;
    readonly textValue?: string;
}

export default class ResourceTags extends PureComponent<ResourceTagsProps, ResourceTagsState> {
    constructor(props: ResourceTagsProps) {
        super(props);
        this.state = {
            pickerMode: "Badges",
            textValue: this.tagsToString(this.props.tagsMap)
        };
    }

    componentDidMount = async () => {};

    componentDidUpdate = (prevProps: ResourceTagsProps) => {
        if (prevProps.tagsMap !== this.props.tagsMap) {
            this.setState({ textValue: this.tagsToString(this.props.tagsMap) });
        }
    };

    tagsToString = (tagMap: ResourceTagsMap): string => {
        const resourceIds = Object.keys(tagMap);

        if (resourceIds.length === 0) {
            return "";
        }

        if (resourceIds.length === 1) {
            const tags = tagMap[resourceIds[0]];
            return tags.map((tag) => `${tag.key}=${tag.value}`).join(", ");
        }

        const allTagKeys = new Set<string>();
        resourceIds.forEach((resourceId) => {
            tagMap[resourceId].forEach((tag) => {
                allTagKeys.add(tag.key);
            });
        });

        const tagStrings: string[] = [];

        allTagKeys.forEach((key) => {
            const valuesForKey = new Set<string>();
            resourceIds.forEach((resourceId) => {
                const tag = tagMap[resourceId].find((t) => t.key === key);
                if (tag) {
                    valuesForKey.add(tag.value);
                }
            });

            if (valuesForKey.size === 1) {
                const value = Array.from(valuesForKey)[0];
                tagStrings.push(`${key}=${value}`);
            } else if (valuesForKey.size > 1) {
                Array.from(valuesForKey).forEach((value) => {
                    tagStrings.push(`${key}=${value}*`);
                });
            }
        });

        return tagStrings.join(", ");
    };

    stringToTags = (text: string): ResourceTagsChangeset => {
        const resourceIds = Object.keys(this.props.tagsMap);
        const changeset: ResourceTagsChangeset = {
            resourceIds,
            remove: [],
            add: [],
            resourceType: this.props.resourceType
        };

        if (!text.trim()) {
            // If text is empty, remove all existing tags
            resourceIds.forEach(resourceId => {
                this.props.tagsMap[resourceId].forEach(tag => {
                    changeset.remove.push({ key: tag.key, value: tag.value });
                });
            });
            return changeset;
        }

        // Parse the text into key-value pairs
        const parsedTags = text.split(',').map(pair => {
            const trimmed = pair.trim();
            const equalIndex = trimmed.indexOf('=');
            if (equalIndex === -1) return null;

            const key = trimmed.substring(0, equalIndex).trim();
            let value = trimmed.substring(equalIndex + 1).trim();
            const hasAsterisk = value.endsWith('*');

            if (hasAsterisk) {
                value = value.slice(0, -1);
            }

            return { key, value, hasAsterisk };
        }).filter(Boolean) as { key: string; value: string; hasAsterisk: boolean }[];

        // Find all existing tags across all resources
        const allExistingTags = new Map<string, Set<string>>();
        resourceIds.forEach(resourceId => {
            this.props.tagsMap[resourceId].forEach(tag => {
                if (!allExistingTags.has(tag.key)) {
                    allExistingTags.set(tag.key, new Set());
                }
                allExistingTags.get(tag.key)!.add(tag.value);
            });
        });

        // Group parsed tags by key
        const parsedTagsByKey = new Map<string, { asterisked: Set<string>; nonAsterisked: Set<string> }>();

        parsedTags.forEach(({ key, value, hasAsterisk }) => {
            if (!parsedTagsByKey.has(key)) {
                parsedTagsByKey.set(key, { asterisked: new Set(), nonAsterisked: new Set() });
            }

            if (hasAsterisk) {
                parsedTagsByKey.get(key)!.asterisked.add(value);
            } else {
                parsedTagsByKey.get(key)!.nonAsterisked.add(value);
            }
        });

        // Process each key to determine changes
        parsedTagsByKey.forEach(({ asterisked, nonAsterisked }, key) => {
            const existingValues = allExistingTags.get(key) || new Set();

            if (nonAsterisked.size > 0 && asterisked.size > 0) {
                // Mixed case: both asterisked and non-asterisked values
                // Non-asterisked values should be added to all resources
                // Asterisked values should be preserved
                const newValue = Array.from(nonAsterisked)[0];

                // Check if all resources have the non-asterisked value
                const resourcesWithNonAsteriskedValue = resourceIds.filter(resourceId => {
                    return this.props.tagsMap[resourceId].some(tag => tag.key === key && tag.value === newValue);
                });

                // If not all resources have this value, we need to add it
                if (resourcesWithNonAsteriskedValue.length < resourceIds.length) {
                    changeset.add.push({ key, value: newValue });
                }

                // Keep all asterisked values (no changes needed for them)
                // Remove any existing values that are not asterisked or the new non-asterisked value
                const targetValues = new Set([newValue, ...asterisked]);
                existingValues.forEach(existingValue => {
                    if (!targetValues.has(existingValue)) {
                        changeset.remove.push({ key, value: existingValue });
                    }
                });
            } else if (nonAsterisked.size > 0) {
                // Only non-asterisked values - apply to all resources
                const newValue = Array.from(nonAsterisked)[0];

                // When we have a non-asterisked value, it means "apply this to all resources"
                // So we need to check if all resources currently have this value
                const resourcesWithThisValue = resourceIds.filter(resourceId => {
                    return this.props.tagsMap[resourceId].some(tag => tag.key === key && tag.value === newValue);
                });

                // If not all resources have this value, we need to add it
                if (resourcesWithThisValue.length < resourceIds.length) {
                    changeset.add.push({ key, value: newValue });
                }

                // Remove all other values for this key (since non-asterisked means "only this value")
                existingValues.forEach(existingValue => {
                    if (existingValue !== newValue) {
                        changeset.remove.push({ key, value: existingValue });
                    }
                });
            } else if (asterisked.size > 0) {
                // Only asterisked values - keep only the specified asterisked values
                // Remove existing values that are not in the asterisked set
                existingValues.forEach(existingValue => {
                    if (!asterisked.has(existingValue)) {
                        changeset.remove.push({ key, value: existingValue });
                    }
                });

                // Add asterisked values that don't exist
                asterisked.forEach(asteriskedValue => {
                    if (!existingValues.has(asteriskedValue)) {
                        changeset.add.push({ key, value: asteriskedValue });
                    }
                });
            }
        });

        // Remove keys that are not mentioned in the parsed text
        allExistingTags.forEach((values, key) => {
            if (!parsedTagsByKey.has(key)) {
                values.forEach(value => {
                    changeset.remove.push({ key, value });
                });
            }
        });

        return changeset;
    };

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`ResourceTags`, this.props.className)}
            >
                <ButtonSelect
                    options={[
                        { label: "Badges", id: "Badges", icon: <TagIcon /> },
                        { label: "Text", id: "Text", icon: <Text /> }
                    ]}
                    onSelectionChange={(option) => {
                        this.setState({ pickerMode: option as PickerMode });
                    }}
                    selectedId={this.state.pickerMode}
                />
                <span>{Object.keys(this.props.tagsMap).length} selected</span>
                {match(this.state.pickerMode)
                    .with("Badges", () => <div>Tags Badges Mode - Not Implemented</div>)
                    .with("Text", () => (
                        <Textarea
                            value={this.state.textValue}
                            onChange={(e) => {
                                this.setState({ textValue: e.target.value });
                            }}
                            onBlur={() => {
                                if (this.props.onCommit && this.state.textValue !== undefined) {
                                    const changeset = this.stringToTags(this.state.textValue);
                                    this.props.onCommit(changeset);
                                }
                            }}
                        />
                    ))
                    .exhaustive()}
            </div>
        );
    };
}
