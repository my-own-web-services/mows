import { FilezFile } from "@firstdorsal/filez-client";
import { CSSProperties, PureComponent } from "react";
import { InputPicker, Panel, PanelGroup, TagPicker } from "rsuite";
import Input from "rsuite/Input";
import { ItemDataType } from "rsuite/esm/@types/common";
import { bytesToHumanReadableSize, utcTimeStampToTimeAndDate } from "../../utils";
import { AiOutlineInfoCircle } from "react-icons/ai";
import { BiHistory, BiLink } from "react-icons/bi";
import { MdStorage } from "react-icons/md";
import { FaPeopleArrows } from "react-icons/fa";

interface MetaEditorProps {
    readonly file?: FilezFile;
    readonly style?: CSSProperties;
}

interface MetaEditorState {
    readonly name: string;
    readonly ownerId: string;
    readonly keywords: string[];
    readonly mimeType: string;
    readonly knownKeywords: string[];
    readonly knownMimeTypes: string[];
    readonly knownOwners: ItemDataType[];
}

export default class MetaEditor extends PureComponent<MetaEditorProps, MetaEditorState> {
    constructor(props: MetaEditorProps) {
        super(props);
        this.state = {
            knownOwners: [],
            name: "",
            ownerId: "",
            keywords: [],
            knownKeywords: [],
            knownMimeTypes: [],
            mimeType: ""
        };
    }

    componentDidMount = async () => {
        await this.loadFile();
    };

    componentDidUpdate = (
        prevProps: Readonly<MetaEditorProps>,
        prevState: Readonly<MetaEditorState>,
        snapshot?: any
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
            knownMimeTypes: [this.props.file.mimeType],
            ownerId: this.props.file.ownerId,
            keywords: this.props.file.keywords,
            mimeType: this.props.file.mimeType,
            name: this.props.file.name
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
                                <Input
                                    className="selectable"
                                    size={inputSize}
                                    value={this.state.name}
                                />
                            </div>
                            <div className="basicsBox">
                                <label>Keywords</label>
                                <TagPicker
                                    size={inputSize}
                                    value={this.state.keywords}
                                    data={this.state.knownKeywords.map(keyword => ({
                                        value: keyword
                                    }))}
                                    block
                                    virtualized
                                />
                            </div>
                            <div className="basicsBox">
                                <label>Owner</label>
                                <InputPicker
                                    size={inputSize}
                                    block
                                    virtualized
                                    value={this.state.ownerId}
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
                                    value={this.state.mimeType}
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
