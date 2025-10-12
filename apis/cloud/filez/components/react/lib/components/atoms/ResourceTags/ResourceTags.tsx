import {
    RESOURCE_TAGS_KEY_VALUE_SEPARATOR,
    RESOURCE_TAGS_NOT_ALL_RESOURCES_SUFFIX,
    RESOURCE_TAGS_SEPARATOR
} from "@/lib/constants";
import { FilezContext } from "@/lib/filezContext/FilezContext";
import { cn } from "@/lib/utils";
import { TagResourceType } from "filez-client-typescript";
import { Search, TagIcon, Text, X } from "lucide-react";
import * as React from "react";
import { PureComponent, type CSSProperties } from "react";
import { IoClose } from "react-icons/io5";
import { MdOutlineLibraryAdd } from "react-icons/md";
import { match } from "ts-pattern";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../ui/input-group";
import { Textarea } from "../../ui/textarea";
import ButtonSelect from "../ButtonSelect/ButtonSelect";

export interface ResourceTagsChangeset {
    resourceIds: string[];
    remove: { key: string; value: string }[];
    add: { key: string; value: string }[];
    resourceType: TagResourceType;
}

export interface ResourceTagsMap {
    [resourceId: string]: { key: string; value: string }[];
}

export interface TagSearchResponse {
    tags: TagSearchResponseItem[];
}

export interface TagSearchResponseItem {
    key: string;
    value: string;
    usageCount: number;
}

export interface TagSearchQuery {
    searchTerm: string;
    resourceType: TagResourceType;
    resourceIds: string[];
}

export interface ResourceTagsProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly onCommit?: (changes: ResourceTagsChangeset) => void;
    readonly tagsMap: ResourceTagsMap;
    readonly resourceType: TagResourceType;
    readonly defaultPickerMode?: PickerMode;
    readonly searchHandler?: (searchQuery: TagSearchQuery) => TagSearchResponse;
}

export type PickerMode = "Badges" | "Text";

export interface ResourceTagsState {
    readonly pickerMode: PickerMode;
    readonly textValue?: string;
    readonly searchTerm: string;
    readonly searchResults: TagSearchResponseItem[];
    readonly showSearchResults: boolean;
}

interface WorkingTag {
    key: string;
    value: string;
    assignedToAllResources: boolean;
}

export default class ResourceTags extends PureComponent<ResourceTagsProps, ResourceTagsState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: ResourceTagsProps) {
        super(props);
        this.state = {
            pickerMode: props.defaultPickerMode || "Badges",
            textValue: this.tagsToString(this.props.tagsMap),
            searchTerm: "",
            searchResults: [],
            showSearchResults: false
        };
    }

    private searchTimeout: NodeJS.Timeout | null = null;

    componentDidMount = async () => {};

    componentDidUpdate = (prevProps: ResourceTagsProps) => {
        if (prevProps.tagsMap !== this.props.tagsMap) {
            this.setState({ textValue: this.tagsToString(this.props.tagsMap) });
        }
    };

    componentWillUnmount = () => {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
    };

    tagsToString = (tagMap: ResourceTagsMap): string => {
        const resourceIds = Object.keys(tagMap);

        if (resourceIds.length === 0) {
            return "";
        }

        if (resourceIds.length === 1) {
            const tags = tagMap[resourceIds[0]];
            return tags
                .map((tag) => `${tag.key}${RESOURCE_TAGS_KEY_VALUE_SEPARATOR}${tag.value}`)
                .join(RESOURCE_TAGS_SEPARATOR + " ");
        }

        const allTagKeys = new Set<string>();
        resourceIds.forEach((resourceId) => {
            tagMap[resourceId].forEach((tag) => {
                allTagKeys.add(tag.key);
            });
        });

        const tagStrings: string[] = [];

        allTagKeys.forEach((key) => {
            const valueCountMap = new Map<string, number>();
            resourceIds.forEach((resourceId) => {
                const tag = tagMap[resourceId].find((t) => t.key === key);
                if (tag) {
                    valueCountMap.set(tag.value, (valueCountMap.get(tag.value) || 0) + 1);
                }
            });

            valueCountMap.forEach((count, value) => {
                if (count === resourceIds.length) {
                    // This value exists on ALL resources - no asterisk
                    tagStrings.push(`${key}${RESOURCE_TAGS_KEY_VALUE_SEPARATOR}${value}`);
                } else {
                    // This value doesn't exist on all resources - add asterisk
                    tagStrings.push(
                        `${key}${RESOURCE_TAGS_KEY_VALUE_SEPARATOR}${value}${RESOURCE_TAGS_NOT_ALL_RESOURCES_SUFFIX}`
                    );
                }
            });
        });

        return tagStrings.join(RESOURCE_TAGS_SEPARATOR + " ");
    };

    stringToTags = (text: string): WorkingTag[] => {
        if (!text.trim()) {
            return [];
        }

        // Parse the text into key-value pairs
        const parsedTags: WorkingTag[] = text.split(RESOURCE_TAGS_SEPARATOR).map((pair) => {
            const trimmed = pair.trim();
            const equalIndex = trimmed.indexOf(RESOURCE_TAGS_KEY_VALUE_SEPARATOR);
            if (equalIndex === -1) throw new Error(`Invalid tag format: ${trimmed}`);

            const key = trimmed.substring(0, equalIndex).trim();
            let value = trimmed.substring(equalIndex + 1).trim();
            const hasAsterisk = value.endsWith(RESOURCE_TAGS_NOT_ALL_RESOURCES_SUFFIX);

            if (hasAsterisk) {
                value = value.slice(0, -1);
            }

            return { key, value, assignedToAllResources: !hasAsterisk };
        });

        return parsedTags;
    };

    createChangeset = (workingTags: WorkingTag[]): ResourceTagsChangeset => {
        const allResourceIds = Object.keys(this.props.tagsMap);
        const changeset: ResourceTagsChangeset = {
            resourceIds: [],
            remove: [],
            add: [],
            resourceType: this.props.resourceType
        };

        // Get current tags in WorkingTag format
        const currentWorkingTags = this.convertMapToCommonTags(this.props.tagsMap);

        // Track which resources will be affected
        const affectedResourceIds = new Set<string>();

        // Create maps for easier comparison
        const currentTagMap = new Map<string, Map<string, boolean>>();
        currentWorkingTags.forEach((tag) => {
            if (!currentTagMap.has(tag.key)) {
                currentTagMap.set(tag.key, new Map());
            }
            currentTagMap.get(tag.key)!.set(tag.value, tag.assignedToAllResources);
        });

        const targetTagMap = new Map<string, Map<string, boolean>>();
        workingTags.forEach((tag) => {
            if (!targetTagMap.has(tag.key)) {
                targetTagMap.set(tag.key, new Map());
            }
            targetTagMap.get(tag.key)!.set(tag.value, tag.assignedToAllResources);
        });

        // Find additions and changes
        targetTagMap.forEach((targetValues, key) => {
            targetValues.forEach((targetAssignedToAll, value) => {
                const currentValues = currentTagMap.get(key);
                const currentAssignedToAll = currentValues?.get(value);

                if (currentAssignedToAll === undefined) {
                    // Tag doesn't exist at all - add it
                    changeset.add.push({ key, value });
                    if (targetAssignedToAll) {
                        // Add to all resources
                        allResourceIds.forEach((id) => affectedResourceIds.add(id));
                    } else {
                        // Add only to resources that don't have it
                        allResourceIds.forEach((resourceId) => {
                            const hasTag = this.props.tagsMap[resourceId].some(
                                (t) => t.key === key && t.value === value
                            );
                            if (!hasTag) {
                                affectedResourceIds.add(resourceId);
                            }
                        });
                    }
                } else if (currentAssignedToAll !== targetAssignedToAll) {
                    // Tag exists but assignment status changed
                    if (targetAssignedToAll && !currentAssignedToAll) {
                        // Need to add to resources that don't have it
                        changeset.add.push({ key, value });
                        allResourceIds.forEach((resourceId) => {
                            const hasTag = this.props.tagsMap[resourceId].some(
                                (t) => t.key === key && t.value === value
                            );
                            if (!hasTag) {
                                affectedResourceIds.add(resourceId);
                            }
                        });
                    }
                    // Note: We don't handle the case where assignedToAll changes from true to false
                    // because that would require selective removal, which is complex
                }
            });
        });

        // Find removals
        currentTagMap.forEach((currentValues, key) => {
            const targetValues = targetTagMap.get(key);
            if (!targetValues) {
                // Key not in target - remove all values for this key
                currentValues.forEach((_, value) => {
                    changeset.remove.push({ key, value });
                    allResourceIds.forEach((resourceId) => {
                        const hasTag = this.props.tagsMap[resourceId].some(
                            (t) => t.key === key && t.value === value
                        );
                        if (hasTag) {
                            affectedResourceIds.add(resourceId);
                        }
                    });
                });
            } else {
                // Key exists in target - check for removed values
                currentValues.forEach((_, value) => {
                    if (!targetValues.has(value)) {
                        changeset.remove.push({ key, value });
                        allResourceIds.forEach((resourceId) => {
                            const hasTag = this.props.tagsMap[resourceId].some(
                                (t) => t.key === key && t.value === value
                            );
                            if (hasTag) {
                                affectedResourceIds.add(resourceId);
                            }
                        });
                    }
                });
            }
        });

        // Set resourceIds based on whether there are actual changes
        if (changeset.add.length > 0 || changeset.remove.length > 0) {
            changeset.resourceIds = Array.from(affectedResourceIds);
        } else {
            changeset.resourceIds = [];
        }

        return changeset;
    };

    convertMapToCommonTags = (tagMap: ResourceTagsMap): WorkingTag[] => {
        const resourceIds = Object.keys(tagMap);
        const commonTags: { key: string; value: string; assignedToAllResources: boolean }[] = [];

        if (resourceIds.length === 0) {
            return commonTags;
        }

        const tagCountMap = new Map<string, Map<string, number>>();

        resourceIds.forEach((resourceId) => {
            tagMap[resourceId].forEach((tag) => {
                if (!tagCountMap.has(tag.key)) {
                    tagCountMap.set(tag.key, new Map<string, number>());
                }
                const valueCountMap = tagCountMap.get(tag.key)!;
                valueCountMap.set(tag.value, (valueCountMap.get(tag.value) || 0) + 1);
            });
        });

        tagCountMap.forEach((valueCountMap, key) => {
            valueCountMap.forEach((count, value) => {
                commonTags.push({
                    key,
                    value,
                    assignedToAllResources: count === resourceIds.length
                });
            });
        });

        return commonTags;
    };

    handleAddToAll = (tag: WorkingTag) => {
        if (!this.props.onCommit) return;

        // Create a changeset that adds this tag to all resources
        const changeset = this.createChangeset([
            ...this.convertMapToCommonTags(this.props.tagsMap).filter(
                (t) => !(t.key === tag.key && t.value === tag.value)
            ),
            { ...tag, assignedToAllResources: true }
        ]);

        this.props.onCommit(changeset);
    };

    handleRemoveFromAll = (tag: WorkingTag) => {
        if (!this.props.onCommit) return;

        // Create a changeset that removes this tag from all resources
        const changeset = this.createChangeset(
            this.convertMapToCommonTags(this.props.tagsMap).filter(
                (t) => !(t.key === tag.key && t.value === tag.value)
            )
        );

        this.props.onCommit(changeset);
    };

    tagMatchesSearch = (tag: WorkingTag): boolean => {
        if (!this.state.searchTerm.trim()) {
            return true;
        }

        const searchLower = this.state.searchTerm.toLowerCase();
        return (
            tag.key.toLowerCase().includes(searchLower) ||
            tag.value.toLowerCase().includes(searchLower)
        );
    };

    handleSearchChange = (searchTerm: string) => {
        this.setState({ searchTerm });

        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Hide search results if search is empty
        if (!searchTerm.trim()) {
            this.setState({ searchResults: [], showSearchResults: false });
            return;
        }

        // Only perform backend search if searchHandler is provided
        if (!this.props.searchHandler) {
            this.setState({ showSearchResults: false });
            return;
        }

        // Debounce the search to avoid too many API calls
        this.searchTimeout = setTimeout(() => {
            const searchQuery: TagSearchQuery = {
                searchTerm: searchTerm.trim(),
                resourceType: this.props.resourceType,
                resourceIds: Object.keys(this.props.tagsMap)
            };

            try {
                const response = this.props.searchHandler!(searchQuery);
                this.setState({
                    searchResults: response.tags,
                    showSearchResults: response.tags.length > 0
                });
            } catch (error) {
                console.error("Tag search error:", error);
                this.setState({ searchResults: [], showSearchResults: false });
            }
        }, 300); // 300ms debounce
    };

    handleSelectSearchResult = (tag: TagSearchResponseItem) => {
        // Add the selected tag to the current tags
        const currentTags = this.convertMapToCommonTags(this.props.tagsMap);
        const newTag: WorkingTag = {
            key: tag.key,
            value: tag.value,
            assignedToAllResources: true
        };

        // Check if tag already exists
        const tagExists = currentTags.some(
            (existingTag) => existingTag.key === tag.key && existingTag.value === tag.value
        );

        if (!tagExists) {
            const updatedTags = [...currentTags, newTag];
            const changeset = this.createChangeset(updatedTags);
            if (this.props.onCommit) {
                this.props.onCommit(changeset);
            }
        }

        // Clear search and hide results
        this.setState({
            searchTerm: "",
            searchResults: [],
            showSearchResults: false
        });
    };

    renderBadges = () => {
        const { t } = this.context!;
        const allTags = this.convertMapToCommonTags(this.props.tagsMap);
        return (
            <div className="outline-muted flex min-h-[40px] flex-wrap gap-2 rounded-lg p-2 outline-1">
                {allTags.map((tag, index) => {
                    const matches = this.tagMatchesSearch(tag);
                    return (
                        <Badge
                            variant={"outline"}
                            key={`${tag.key}-${tag.value}-${index}`}
                            className={cn(
                                "inline-flex items-center justify-between gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium transition-colors",
                                !matches && "opacity-30 hover:opacity-100"
                            )}
                        >
                            <span>
                                {tag.key}
                                {RESOURCE_TAGS_KEY_VALUE_SEPARATOR}
                                {tag.value}
                            </span>
                            <span className="-gap-1 flex items-center">
                                {!tag.assignedToAllResources && (
                                    <Button
                                        title={t.resourceTags.addToAll}
                                        variant={"iconStandalone"}
                                        size="icon-xs"
                                        className="TagAddToAll hover:text-success"
                                        onClick={() => this.handleAddToAll(tag)}
                                    >
                                        <MdOutlineLibraryAdd />
                                    </Button>
                                )}
                                <Button
                                    title={t.resourceTags.removeFromAll}
                                    variant={"iconStandalone"}
                                    size="icon-xs"
                                    className="TagRemoveFromAll hover:text-destructive"
                                    onClick={() => this.handleRemoveFromAll(tag)}
                                >
                                    <IoClose />
                                </Button>
                            </span>
                        </Badge>
                    );
                })}
            </div>
        );
    };

    renderSearchResults = () => {
        if (!this.state.showSearchResults || this.state.searchResults.length === 0) {
            return null;
        }

        const { t } = this.context!;

        return (
            <div className="bg-popover absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border shadow-md">
                {this.state.searchResults.map((tag, index) => (
                    <button
                        key={`${tag.key}-${tag.value}-${index}`}
                        type="button"
                        className="hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                        onClick={() => this.handleSelectSearchResult(tag)}
                    >
                        <span>
                            {tag.key}
                            {RESOURCE_TAGS_KEY_VALUE_SEPARATOR}
                            {tag.value}
                        </span>
                        <span className="text-muted-foreground text-xs">{tag.usageCount}</span>
                    </button>
                ))}
            </div>
        );
    };

    commitTextArea = () => {
        if (this.props.onCommit && this.state.textValue !== undefined) {
            const workingTags = this.stringToTags(this.state.textValue);
            const changeset = this.createChangeset(workingTags);

            this.props.onCommit(changeset);
        }
    };

    renderTextArea = () => {
        const { t } = this.context!;
        const notChanged = this.state.textValue === this.tagsToString(this.props.tagsMap);

        return (
            <div className="flex flex-col gap-2">
                <Textarea
                    value={this.state.textValue}
                    onChange={(e) => {
                        this.setState({ textValue: e.target.value });
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            this.commitTextArea();
                        }
                    }}
                />
                <span className="flex gap-2">
                    <Button disabled={notChanged} onClick={this.commitTextArea}>
                        {t.resourceTags.saveTextTags}
                    </Button>
                    <Button disabled={notChanged} variant={"secondary"}>
                        {t.resourceTags.cancel}
                    </Button>
                </span>
            </div>
        );
    };

    render = () => {
        const { t } = this.context!;

        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`ResourceTags`, "flex flex-col gap-2", this.props.className)}
            >
                <div className="flex items-center justify-between gap-4">
                    <ButtonSelect
                        size="icon-sm"
                        options={[
                            { label: t.resourceTags.badges, id: "Badges", icon: <TagIcon /> },
                            { label: t.resourceTags.text, id: "Text", icon: <Text /> }
                        ]}
                        onSelectionChange={(option) => {
                            this.setState({ pickerMode: option as PickerMode });
                        }}
                        selectedId={this.state.pickerMode}
                    />
                    <span>
                        {Object.keys(this.props.tagsMap).length} {t.resourceTags.selected}
                    </span>
                </div>

                <div>
                    {match(this.state.pickerMode)
                        .with("Badges", () => this.renderBadges())
                        .with("Text", () => this.renderTextArea())
                        .exhaustive()}
                </div>
                {this.state.pickerMode === "Badges" && (
                    <div className="relative">
                        <InputGroup>
                            <InputGroupAddon>
                                <Search className="text-muted-foreground h-4 w-4" />
                            </InputGroupAddon>
                            <InputGroupInput
                                type="text"
                                placeholder={t.resourceTags.searchPlaceholder}
                                value={this.state.searchTerm}
                                onChange={(e) => this.handleSearchChange(e.target.value)}
                                className="pr-8 pl-8"
                            />
                            {this.state.searchTerm && (
                                <InputGroupAddon>
                                    <Button
                                        variant="iconStandalone"
                                        size="icon-xs"
                                        className="hover:text-destructive absolute top-1/2 right-2 -translate-y-1/2"
                                        onClick={() => {
                                            this.setState({
                                                searchTerm: "",
                                                searchResults: [],
                                                showSearchResults: false
                                            });
                                        }}
                                        title={t.resourceTags.clearSearch}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </InputGroupAddon>
                            )}
                        </InputGroup>
                        {this.renderSearchResults()}
                    </div>
                )}
            </div>
        );
    };
}
