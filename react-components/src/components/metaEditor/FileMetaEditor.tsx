import { CSSProperties, PureComponent } from "react";
import { IconButton, InputGroup, InputPicker, Panel, PanelGroup, TagPicker } from "rsuite";
import Input from "rsuite/Input";
import { ItemDataType } from "rsuite/esm/@types/common";
import { bytesToHumanReadableSize, utcTimeStampToTimeAndDate } from "../../utils";
import { AiOutlineCheck, AiOutlineInfoCircle } from "react-icons/ai";
import { BiHistory, BiLink, BiUndo } from "react-icons/bi";
import { MdStorage } from "react-icons/md";
import { FaPeopleArrows } from "react-icons/fa";
import { FileDownload } from "@rsuite/icons";
import { FilezContext } from "../../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { cloneDeep } from "lodash";
import update from "immutability-helper";

interface MetaEditorProps {
    readonly file: FilezFile;
    readonly style?: CSSProperties;
}

interface MetaEditorState {
    readonly localData: MetaData;
    readonly serverData: MetaData;
    readonly knownKeywords: string[];
    readonly knownMimeTypes: string[];
    readonly knownOwners: ItemDataType[];
}

interface MetaData {
    readonly name: string;
    readonly ownerId: string;
    readonly keywords: string[];
    readonly mimeType: string;
}

export default class MetaEditor extends PureComponent<MetaEditorProps, MetaEditorState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: MetaEditorProps) {
        super(props);

        const data: MetaData = {
            ownerId: props.file.ownerId,
            keywords: props.file.keywords,
            mimeType: props.file.mimeType,
            name: props.file.name
        };

        this.state = {
            knownOwners: [],
            knownKeywords: [],
            knownMimeTypes: [props.file.mimeType],
            localData: cloneDeep(data),
            serverData: cloneDeep(data)
        };
    }

    componentDidMount = async () => {
        await this.loadFile();
    };

    componentDidUpdate = (
        prevProps: Readonly<MetaEditorProps>,
        _prevState: Readonly<MetaEditorState>,
        _snapshot?: any
    ) => {
        if (prevProps.file !== this.props.file) {
            this.loadFile();
        }
    };

    loadFile = async () => {
        if (!this.props.file) return;

        this.setState({
            knownOwners: [{ value: this.props.file.ownerId, label: this.props.file.ownerId }],
            knownKeywords: [],
            knownMimeTypes: [this.props.file.mimeType]
        });
    };

    render = () => {
        if (!this.props.file) return;

        const inputSize = "sm";
        return (
            <div style={{ ...this.props.style }} className="Filez FileMetaEditor">
                <PanelGroup accordion bordered>
                    <Panel
                        className="basicsPanel panel"
                        collapsible
                        header={
                            <div className="header">
                                <span className="icon">
                                    <AiOutlineInfoCircle size={18} />
                                </span>
                                <span>Basics</span>
                            </div>
                        }
                        bordered
                    >
                        <div>
                            <div className="basicsBox">
                                <label>Name</label>
                                <InputGroup>
                                    <Input
                                        className="selectable"
                                        size={inputSize}
                                        value={this.state.localData.name}
                                        onChange={(value: string) => {
                                            this.setState(
                                                update(this.state, {
                                                    localData: {
                                                        name: { $set: value }
                                                    }
                                                })
                                            );
                                        }}
                                    />
                                    {this.state.localData.name !== this.state.serverData.name && (
                                        <>
                                            <InputGroup.Button
                                                onClick={() => {
                                                    this.setState(
                                                        update(this.state, {
                                                            localData: {
                                                                name: {
                                                                    $set: this.state.serverData.name
                                                                }
                                                            }
                                                        })
                                                    );
                                                }}
                                                title="Cancel"
                                            >
                                                <BiUndo />
                                            </InputGroup.Button>
                                            <InputGroup.Button appearance="primary" title="Save">
                                                <AiOutlineCheck />
                                            </InputGroup.Button>
                                        </>
                                    )}
                                </InputGroup>
                            </div>
                            <div className="basicsBox">
                                <label>Keywords</label>
                                <TagPicker
                                    size={inputSize}
                                    value={this.state.localData.keywords}
                                    data={this.state.knownKeywords.map(keyword => ({
                                        value: keyword
                                    }))}
                                    onChange={(keywords: string[]) => {
                                        this.setState(
                                            update(this.state, {
                                                localData: {
                                                    keywords: { $set: keywords }
                                                }
                                            })
                                        );
                                    }}
                                    block
                                    virtualized
                                    creatable
                                />
                            </div>
                            <div className="basicsBox">
                                <label>Owner</label>
                                <InputPicker
                                    size={inputSize}
                                    block
                                    virtualized
                                    value={this.state.localData.ownerId}
                                    data={this.state.knownOwners}
                                />
                            </div>
                            <div className="basicsBox">
                                <label>Mime Type</label>
                                <InputPicker
                                    size={inputSize}
                                    block
                                    virtualized
                                    creatable
                                    value={this.state.localData.mimeType}
                                    data={this.state.knownMimeTypes.map(mimeType => ({
                                        value: mimeType,
                                        label: mimeType
                                    }))}
                                />
                            </div>
                        </div>
                        <div className="basicsBox">
                            <div className="created">
                                <label>Created</label>
                                {utcTimeStampToTimeAndDate(this.props.file.created)}
                            </div>
                            <div className="modified">
                                <label>Modified</label>

                                {this.props.file.modified !== null &&
                                    utcTimeStampToTimeAndDate(this.props.file.modified)}
                            </div>
                            <div className="size">
                                <label>Size</label>
                                {bytesToHumanReadableSize(this.props.file.size)}
                            </div>
                        </div>
                        <div className="Export">
                            <a
                                href={`${this.context?.uiConfig.filezServerAddress}/api/get_file/${this.props.file?._id}?d`}
                            >
                                <IconButton
                                    placement="right"
                                    appearance="primary"
                                    icon={<FileDownload />}
                                >
                                    Download
                                </IconButton>
                            </a>
                        </div>
                    </Panel>
                    <Panel
                        className="panel"
                        collapsible
                        header={
                            <div className="header">
                                <span className="icon">
                                    <MdStorage size={18} />
                                </span>
                                <span>Storage</span>
                            </div>
                        }
                        bordered
                    ></Panel>
                    <Panel
                        className="panel"
                        collapsible
                        header={
                            <div className="header">
                                <span className="icon">
                                    <FaPeopleArrows size={18} />
                                </span>
                                <span>Access Control</span>
                            </div>
                        }
                        bordered
                    ></Panel>
                    <Panel
                        className="panel"
                        collapsible
                        header={
                            <div className="header">
                                <span className="icon">
                                    <BiLink
                                        size={18}
                                        style={{ transform: "translate(0px,2px) scale(1.3)" }}
                                    />
                                </span>
                                <span>Linked Files</span>
                            </div>
                        }
                        bordered
                    ></Panel>
                    <Panel
                        className="panel"
                        collapsible
                        header={
                            <div className="header">
                                <span className="icon">
                                    <BiHistory
                                        size={18}
                                        style={{ transform: "translate(0px,3px) scale(1.1)" }}
                                    />
                                </span>
                                <span>History</span>
                            </div>
                        }
                        bordered
                    ></Panel>
                </PanelGroup>
            </div>
        );
    };
}

// TODO create a user defined panel with the fields they want to see
