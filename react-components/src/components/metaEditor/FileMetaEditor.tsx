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
import KeywordPicker from "./KeywordPicker";
import Name from "./Name";
import Permission from "../list/permissions/Permission";
import { isEqual } from "lodash";
import StoragePicker from "./StoragePicker";
import StaticFileGroupPicker from "./StaticFileGroupPicker";

interface MetaEditorProps {
    readonly fileIds: string[];
    readonly style?: CSSProperties;
}

interface MetaEditorState {
    readonly files: FilezFile[] | null;
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
            files: null
        };
    }

    componentDidMount = async () => {
        await this.loadFileInfos();
    };

    componentDidUpdate = async (
        prevProps: Readonly<MetaEditorProps>,
        _prevState: Readonly<MetaEditorState>,
        _snapshot?: any
    ) => {
        if (!isEqual(prevProps.fileIds, this.props.fileIds)) {
            await this.loadFileInfos();
        }
    };

    loadFileInfos = async () => {
        if (!this.context) return;

        const files = await this.context.filezClient.get_file_infos(this.props.fileIds);

        this.setState({
            files
        });
    };

    render = () => {
        if (this.state.files === null) {
            return;
        }
        const inputSize = "sm";

        const singleFile = this.state.files.length === 1 ? this.state.files[0] : null;

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
                            {singleFile && (
                                <div className="basicsBox">
                                    <Name file={singleFile} inputSize={inputSize} />
                                </div>
                            )}
                            <div className="basicsBox">
                                <label>Static File Groups</label>
                                <StaticFileGroupPicker
                                    size={inputSize}
                                    resources={this.state.files}
                                />
                            </div>
                            <div className="basicsBox">
                                <label>Keywords</label>
                                <KeywordPicker
                                    resourceType="File"
                                    resources={this.state.files}
                                    inputSize={inputSize}
                                />
                            </div>
                            {singleFile && (
                                <div className="basicsBox">
                                    <label>Owner</label>
                                    <InputPicker
                                        size={inputSize}
                                        block
                                        virtualized
                                        value={singleFile.owner_id}
                                        data={this.state.knownOwners}
                                    />
                                </div>
                            )}
                            {singleFile && (
                                <div className="basicsBox">
                                    <label>Mime Type</label>
                                    <InputPicker
                                        size={inputSize}
                                        block
                                        virtualized
                                        creatable
                                        value={singleFile.mime_type}
                                        data={this.state.knownMimeTypes.map(mimeType => ({
                                            value: mimeType,
                                            label: mimeType
                                        }))}
                                    />
                                </div>
                            )}
                        </div>
                        {singleFile && (
                            <div className="basicsBox">
                                <div className="created">
                                    <label>Created</label>
                                    {utcTimeStampToTimeAndDate(singleFile.created)}
                                </div>
                                <div className="modified">
                                    <label>Modified</label>

                                    {singleFile.modified !== null &&
                                        utcTimeStampToTimeAndDate(singleFile.modified)}
                                </div>
                                <div className="size">
                                    <label>Size</label>
                                    {bytesToHumanReadableSize(singleFile.size)}
                                </div>
                            </div>
                        )}
                        {singleFile && (
                            <div className="Export">
                                <a
                                    href={`${this.context?.uiConfig.filezServerAddress}/api/file/get/${singleFile._id}?d`}
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
                        )}
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
                        {singleFile && (
                            <Permission
                                useOnce
                                disableTypeChange
                                hideTypeChanger
                                permissionType="File"
                                size={inputSize}
                                itemId={singleFile._id}
                            />
                        )}
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
                    >
                        <StoragePicker
                            fileIds={this.state.files.map(file => file._id)}
                        ></StoragePicker>
                    </Panel>

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
