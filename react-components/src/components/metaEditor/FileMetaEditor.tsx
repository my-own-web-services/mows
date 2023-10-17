import { CSSProperties, PureComponent } from "react";
import { IconButton, InputPicker, Panel, PanelGroup } from "rsuite";
import { ItemDataType } from "rsuite/esm/@types/common";
import { bytesToHumanReadableSize, utcTimeStampToTimeAndDate } from "../../utils";
import { AiOutlineInfoCircle } from "react-icons/ai";
import { BiHistory, BiLink } from "react-icons/bi";
import { MdStorage } from "react-icons/md";
import { FaPeopleArrows } from "react-icons/fa";
import { FileDownload } from "@rsuite/icons";
import { FilezContext } from "../../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import Keywords from "./Keywords";
import Name from "./Name";
import FileAccessControl from "./FileAccessControl";

interface MetaEditorProps {
    readonly fileId: string;
    readonly style?: CSSProperties;
}

interface MetaEditorState {
    readonly file: FilezFile;
    readonly knownMimeTypes: string[];
    readonly knownOwners: ItemDataType[];
}

export default class MetaEditor extends PureComponent<MetaEditorProps, MetaEditorState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: MetaEditorProps) {
        super(props);

        this.state = {
            knownOwners: [],
            knownMimeTypes: [],
            file: null as unknown as FilezFile
        };
    }

    componentDidMount = async () => {
        await this.loadFile();
    };

    componentDidUpdate = async (
        prevProps: Readonly<MetaEditorProps>,
        _prevState: Readonly<MetaEditorState>,
        _snapshot?: any
    ) => {
        if (prevProps.fileId !== this.props.fileId) {
            await this.loadFile();
        }
    };

    loadFile = async () => {
        if (!this.context) return;

        const file = await this.context.filezClient.get_file_info(this.props.fileId);

        this.setState({
            file
        });
    };

    render = () => {
        if (this.state.file === null) {
            return;
        }
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
                                <Name file={this.state.file} inputSize={inputSize} />
                            </div>
                            <div className="basicsBox">
                                <Keywords file={this.state.file} inputSize={inputSize} />
                            </div>
                            <div className="basicsBox">
                                <label>Owner</label>
                                <InputPicker
                                    size={inputSize}
                                    block
                                    virtualized
                                    value={this.state.file.ownerId}
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
                                    value={this.state.file.mimeType}
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
                                {utcTimeStampToTimeAndDate(this.state.file.created)}
                            </div>
                            <div className="modified">
                                <label>Modified</label>

                                {this.state.file.modified !== null &&
                                    utcTimeStampToTimeAndDate(this.state.file.modified)}
                            </div>
                            <div className="size">
                                <label>Size</label>
                                {bytesToHumanReadableSize(this.state.file.size)}
                            </div>
                        </div>
                        <div className="Export">
                            <a
                                href={`${this.context?.uiConfig.filezServerAddress}/api/get_file/${this.props.fileId}?d`}
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
                                    <FaPeopleArrows size={18} />
                                </span>
                                <span>Access </span>
                            </div>
                        }
                        bordered
                    >
                        <FileAccessControl file={this.state.file} inputSize={inputSize} />
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
