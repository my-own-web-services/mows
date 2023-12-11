import { PureComponent } from "react";
import { BsPeople } from "react-icons/bs";
import { FaMapLocationDot } from "react-icons/fa6";
import { FilezContext } from "../../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import MultiItemTagPicker, {
    Category,
    MultiItemTagPickerResources,
    TagData
} from "./MultiItemTagPicker";

const knownCategories: Category[] = [
    {
        name: "Persons",
        render: (keyword: string) => {
            return (
                <>
                    <div style={{ float: "left", marginRight: "4px" }}>
                        <BsPeople size={12} style={{ transform: "translate(0px,2px)" }} />
                    </div>
                    <div style={{ float: "left" }}>{keyword.split(">")[1]}</div>
                </>
            );
        }
    },
    {
        name: "Locations",
        render: (keyword: string) => {
            return (
                <>
                    <div style={{ float: "left", marginRight: "4px" }}>
                        <FaMapLocationDot size={12} style={{ transform: "translate(0px,1.5px)" }} />
                    </div>
                    <div style={{ float: "left" }}>{keyword.split(">")[1]}</div>
                </>
            );
        }
    }
];

interface KeywordPickerProps {
    /**
     * @default "md"
     * The Size of the input
     */
    readonly inputSize?: "lg" | "md" | "sm" | "xs";
    /**
     * What type of resources are being edited
     */
    readonly resourceType: "File" | "FileGroup" | "ToBeUploadedFile";
    /**
     * The resources to edit
     */
    readonly resources?: FilezFile[] | FilezFileGroup[] | ToBeUploadedFile[];
    /**
     * Called when the user changes the selection of keywords
     */
    readonly onChange?: (resources: MultiItemTagPickerResources) => void;
    /**
     *  Should the component be disabled
     */
    readonly disabled?: boolean;
    /**
     * Should the component directly handle the server update of the resources
     */
    readonly serverUpdate?: boolean;
}

interface KeywordPickerState {
    readonly knownKeywords: TagData[];
    readonly resourceMap: MultiItemTagPickerResources;
    readonly knownKeywordsLoaded: boolean;
}

export interface ToBeUploadedFile {
    _id: string;
    keywords: string[];
}

export default class KeywordPicker extends PureComponent<KeywordPickerProps, KeywordPickerState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: KeywordPickerProps) {
        super(props);
        this.state = {
            resourceMap: {},
            knownKeywordsLoaded: false,
            knownKeywords: []
        };
    }

    componentDidMount = async () => {
        await this.init();
    };

    init = async () => {
        const knownKeywordsStrings = await this.get_keywords(this.props.resources);
        const resourceMap = this.resourcesToSelectedTags(this.props.resources);

        this.setState({
            knownKeywords: knownKeywordsStrings.map(value => ({ value })),
            resourceMap,
            knownKeywordsLoaded: true
        });
    };

    get_keywords = async (
        resources?: FilezFile[] | FilezFileGroup[] | ToBeUploadedFile[]
    ): Promise<string[]> => {
        if (!this.context) throw new Error("No filez context set");
        const otherResourcesKeywords = await this.context.filezClient.get_aggregated_keywords();

        const currenResourceKeywords = resources?.flatMap(resource => resource.keywords) ?? [];

        const distincKeywords: string[] = [
            ...new Set([...currenResourceKeywords, ...otherResourcesKeywords])
        ];

        return distincKeywords;
    };

    resourcesToSelectedTags = (resources?: FilezFile[] | FilezFileGroup[] | ToBeUploadedFile[]) => {
        const selectedTagsMap: MultiItemTagPickerResources = {};
        resources?.forEach(resource => {
            selectedTagsMap[resource._id] = resource.keywords;
        });
        return selectedTagsMap;
    };

    onTagChange = async (resourceMap: MultiItemTagPickerResources, knownKeywords: TagData[]) => {
        if (this.props.serverUpdate !== false) {
            this.context?.filezClient.update_file_infos(
                Object.entries(resourceMap).map(([file_id, keywords]) => {
                    return {
                        file_id,
                        fields: {
                            keywords
                        }
                    };
                })
            );
        }
        this.setState({ knownKeywords, resourceMap });

        this.props.onChange?.(resourceMap);
    };

    render = () => {
        if (this.state.knownKeywordsLoaded === false) return null;

        return (
            <div className="Keywords">
                <MultiItemTagPicker
                    multiItemSelectedTags={this.state.resourceMap}
                    knownCategories={knownCategories}
                    possibleTags={this.state.knownKeywords}
                    onChange={this.onTagChange}
                    creatable
                />
            </div>
        );
    };
}

/*
splitAndFixKeywords = (keywords: string[]): string[] => {
        return keywords
            .flatMap(keyword => {
                if (keyword.includes(",")) {
                    return keyword
                        .split(",")
                        .map(keyword => keyword.trim())
                        .filter(keyword => keyword !== "");
                } else {
                    return keyword;
                }
            })
            .map(keyword => {
                // if keyword includes > character trim the whitespace in front and after
                if (keyword.includes(">")) {
                    return keyword
                        .split(">")
                        .map(keyword => {
                            const trimmed_keyword = keyword.trim();
                            let return_word = trimmed_keyword;
                            for (const knownCategory of knownCategories) {
                                if (knownCategory.name.toLowerCase() === trimmed_keyword) {
                                    return_word = knownCategory.name;
                                    break;
                                }
                            }
                            return return_word;
                        })

                        .join(">");
                } else {
                    return keyword;
                }
            });
    };


<TagPicker
                    size={this.props.inputSize}
                    value={this.state.selectedKeywords}
                    groupBy="category"
                    block
                    virtualized
                    creatable
                    cleanable={false}
                    disabled={this.props.disabled}
                    data={this.state.knownKeywords.map(keyword => {
                        return {
                            value: keyword.value,
                            label: (() => {
                                const dontApplyToAllSymbol =
                                    keyword.appliedResourceIds.length ===
                                    this.props.resources?.length
                                        ? ""
                                        : "*";

                                const val = keyword.value + dontApplyToAllSymbol;

                                if (keyword.value.includes(">")) {
                                    const currentCategory = keyword.value.split(">")[0];

                                    const foundKnownCategory = knownCategories.find(
                                        c => c.name === currentCategory
                                    );

                                    if (foundKnownCategory) {
                                        return foundKnownCategory.render(val);
                                    } else {
                                        return val;
                                    }
                                } else {
                                    return val;
                                }
                            })(),
                            category: (() => {
                                if (keyword.value.includes(">")) {
                                    return keyword.value.split(">")[0];
                                } else {
                                    return "Other";
                                }
                            })()
                        };
                    })}
                    searchBy={(keyword: string, _label: ReactNode, item: ItemDataType) => {
                        const keywordToSearch = keyword.toLowerCase();
                        const valueToSearch = item.value?.toString().toLowerCase();

                        if (valueToSearch === undefined) return false;
                        return valueToSearch.includes(keywordToSearch);
                    }}
                    onCreate={this.handleCreate}
                    onTagRemove={this.handleTagRemove}
                    onSelect={this.handleSelect}
                />




 onChange={async (keywords: string[]) => {
                        // if keyword contains commas it will be split into multiple keywords with trimmed whitespace
                        keywords = keywords
                            .flatMap(keyword => {
                                if (keyword.includes(",")) {
                                    return keyword
                                        .split(",")
                                        .map(keyword => keyword.trim())
                                        .filter(keyword => keyword !== "");
                                } else {
                                    return keyword;
                                }
                            })
                            .map(keyword => {
                                // if keyword includes > character trim the whitespace in front and after
                                if (keyword.includes(">")) {
                                    return keyword
                                        .split(">")
                                        .map(keyword => {
                                            const trimmed_keyword = keyword.trim();
                                            let return_word = trimmed_keyword;
                                            for (const knownCategory of knownCategories) {
                                                if (
                                                    knownCategory.name.toLowerCase() ===
                                                    trimmed_keyword
                                                ) {
                                                    return_word = knownCategory.name;
                                                    break;
                                                }
                                            }
                                            return return_word;
                                        })

                                        .join(">");
                                } else {
                                    return keyword;
                                }
                            });

                        // get distinct
                        keywords = [...new Set(keywords)];

                        this.setState(
                            update(this.state, {
                                selectedKeywords: {
                                    $set: keywords.map(keyword => {
                                        return {
                                            value: keyword,
                                            appliedResourceIds:
                                                this.props.resources?.map(
                                                    resource => resource._id
                                                ) ?? []
                                        };
                                    })
                                },
                                knownKeywords: {
                                    $set: (() => {
                                        const distinctKeywords = new Set([
                                            ...this.state.knownKeywords,
                                            ...keywords
                                        ]);
                                        return [...distinctKeywords];
                                    })()
                                }
                            }),
                            () => {
                                this.props.onKeywordsChanged?.(this.state.selectedKeywords);
                            }
                        );
                    }}

*/
