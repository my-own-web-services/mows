import { PureComponent, ReactNode } from "react";
import { BsPeople } from "react-icons/bs";
import { FaMapLocationDot } from "react-icons/fa6";
import { TagPicker } from "rsuite";
import { ItemDataType } from "rsuite/esm/@types/common";
import update from "immutability-helper";
import { FilezContext } from "../../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { cloneDeep } from "lodash";

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

interface KeywordsProps {
    readonly inputSize: "lg" | "md" | "sm" | "xs";
    readonly file: FilezFile;
}

interface KeywordsState {
    readonly knownKeywords: string[];
    readonly localKeywords: string[];
    readonly serverKeywords: string[];
}

export default class Keywords extends PureComponent<KeywordsProps, KeywordsState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: KeywordsProps) {
        super(props);
        this.state = {
            knownKeywords: [],
            localKeywords: [],
            serverKeywords: []
        };
    }

    componentDidMount = async () => {
        await this.init();
    };

    init = async () => {
        await this.loadKeywords();
        this.setState(state =>
            update(state, {
                localKeywords: { $set: cloneDeep(this.props.file.keywords) },
                serverKeywords: { $set: cloneDeep(this.props.file.keywords) }
            })
        );
    };

    componentDidUpdate = async (
        prevProps: Readonly<KeywordsProps>,
        _prevState: Readonly<KeywordsState>,
        _snapshot?: any
    ) => {
        if (prevProps.file._id !== this.props.file._id) {
            await this.init();
        }
    };

    loadKeywords = async () => {
        if (!this.context) throw new Error("No filez context set");
        const knownKeywords = await this.get_keywords(this.props.file);
        this.setState({
            knownKeywords
        });
    };

    get_keywords = async (file: FilezFile) => {
        if (!this.context) throw new Error("No filez context set");
        const otherDocumentKeywords = await this.context.filezClient.get_aggregated_keywords();
        const thisDocumentKeywords = file.keywords;
        const distinctKeywords = new Set([...otherDocumentKeywords, ...thisDocumentKeywords]);
        return [...distinctKeywords];
    };

    render = () => {
        if (this.state.knownKeywords.length === 0) return null;

        return (
            <div className="Keywords">
                <label>Keywords</label>
                <TagPicker
                    size={this.props.inputSize}
                    value={this.state.localKeywords}
                    groupBy="category"
                    data={this.state.knownKeywords.map(keyword => {
                        return {
                            value: keyword,
                            label: (() => {
                                if (keyword.includes(">")) {
                                    const currentCategory = keyword.split(">")[0];

                                    const foundKnownCategory = knownCategories.find(
                                        c => c.name === currentCategory
                                    );
                                    if (foundKnownCategory) {
                                        return foundKnownCategory.render(keyword);
                                    } else {
                                        return keyword;
                                    }
                                } else {
                                    return keyword;
                                }
                            })(),
                            category: (() => {
                                if (keyword.includes(">")) {
                                    return keyword.split(">")[0];
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
                                localKeywords: { $set: keywords },
                                knownKeywords: {
                                    $set: (() => {
                                        const distinctKeywords = new Set([
                                            ...this.state.knownKeywords,
                                            ...keywords
                                        ]);
                                        return [...distinctKeywords];
                                    })()
                                }
                            })
                        );
                        const res = await this.context?.filezClient.update_file_infos(
                            this.props.file._id,
                            {
                                Keywords: keywords
                            }
                        );
                        if (res?.status === 200) {
                            this.setState(
                                update(this.state, {
                                    serverKeywords: { $set: keywords }
                                })
                            );
                        }
                    }}
                    block
                    virtualized
                    creatable
                    cleanable={false}
                />
            </div>
        );
    };
}
