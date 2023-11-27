import { PureComponent, ReactNode } from "react";
import { BsPeople } from "react-icons/bs";
import { FaMapLocationDot } from "react-icons/fa6";
import { TagPicker } from "rsuite";
import { ItemDataType } from "rsuite/esm/@types/common";
import update from "immutability-helper";
import { FilezContext } from "../../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";

const knownCategories = [
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
    readonly inputSize?: "lg" | "md" | "sm" | "xs";
    readonly resourceType: "File" | "FileGroup";
    readonly resources?: FilezFile[] | FilezFileGroup[];
    readonly onKeywordsChanged?: (keywords: Keyword[]) => void;
    readonly disabled?: boolean;
}

interface KeywordPickerState {
    readonly knownKeywords: Keyword[];
    readonly selectedKeywords: string[];
    readonly knownKeywordsLoaded: boolean;
}

export interface Keyword {
    readonly value: string;
    readonly appliedResourceIds: string[];
}

export default class KeywordPicker extends PureComponent<KeywordPickerProps, KeywordPickerState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: KeywordPickerProps) {
        super(props);
        this.state = {
            knownKeywords: [],
            selectedKeywords: [],
            knownKeywordsLoaded: false
        };
    }

    componentDidMount = async () => {
        await this.init();
    };

    init = async () => {
        await this.loadKeywords();
    };

    loadKeywords = async () => {
        if (!this.context) throw new Error("No filez context set");
        const knownKeywords = await this.get_keywords(this.props.resources);

        const selectedKeywords: string[] = [];
        this.props.resources?.forEach(resource => {
            resource.keywords.forEach(keyword => {
                if (!selectedKeywords.includes(keyword)) {
                    selectedKeywords.push(keyword);
                }
            });
        });

        this.setState({
            knownKeywords,
            knownKeywordsLoaded: true,
            selectedKeywords
        });
    };

    get_keywords = async (resources?: FilezFile[] | FilezFileGroup[]): Promise<Keyword[]> => {
        if (!this.context) throw new Error("No filez context set");
        const otherResourcesKeywords = await this.context.filezClient.get_aggregated_keywords();

        const distincKeywords: Keyword[] = [];

        otherResourcesKeywords.forEach(keyword => {
            distincKeywords.push({
                value: keyword,
                appliedResourceIds:
                    resources?.flatMap(resource => {
                        if (resource.keywords.includes(keyword)) {
                            return [resource._id];
                        } else {
                            return [];
                        }
                    }) ?? []
            });
        });

        return distincKeywords;
    };

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

    handleCreate = async (keyword: string) => {
        const keywords = this.splitAndFixKeywords([keyword]);

        this.setState(
            update(this.state, {
                selectedKeywords: {
                    $set: keywords
                },
                knownKeywords: {
                    $push: (() => {
                        return keywords.flatMap(keyword => {
                            if (!this.state.knownKeywords.map(k => k.value).includes(keyword)) {
                                return [
                                    {
                                        value: keyword,
                                        appliedResourceIds:
                                            this.props.resources?.map(resource => resource._id) ??
                                            []
                                    }
                                ];
                            } else {
                                return [];
                            }
                        });
                    })()
                }
            }),
            () => {}
        );
    };

    handleTagRemove = async (keyword: string) => {};

    handleSelect = async (keywords: string[]) => {};

    render = () => {
        if (this.state.knownKeywordsLoaded === false) return null;

        return (
            <div className="Keywords">
                <label className={this.props.disabled ? "disabled" : ""}>Keywords</label>
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
            </div>
        );
    };
}

/*
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
