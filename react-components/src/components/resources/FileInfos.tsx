import { CSSProperties, PureComponent } from "react";
import { IconButton, InputPicker, Panel, PanelGroup } from "rsuite";
import { ItemDataType } from "rsuite/esm/@types/common";
import {
    bytesToHumanReadableSize,
    utcTimeStampToTimeAndDate
} from "../../utils";
import { AiOutlineInfoCircle } from "react-icons/ai";
import { BiHistory, BiLink } from "react-icons/bi";
import { MdStorage } from "react-icons/md";
import { FaPeopleArrows } from "react-icons/fa";
import { FileDownload } from "@rsuite/icons";
import { FilezContext } from "../../FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import KeywordPicker from "../atoms/KeywordPicker";
import Name from "../atoms/SingleName";
import Permission from "./Permission";
import { isEqual } from "lodash";
import StaticFileGroupPicker from "../atoms/StaticFileGroupPicker";
import ResourcePicker from "../atoms/ResourcePicker";
import { TagData } from "../atoms/MultiItemTagPicker";
import { UsageLimits } from "@firstdorsal/filez-client/dist/js/apiTypes/UsageLimits";
import StoragePicker from "../atoms/StoragePicker";

interface StorageOptions {
    storage_id: string;
    limits: UsageLimits;
}

interface FileMetaEditorProps {
    readonly fileIds: string[];
    readonly style?: CSSProperties;
    readonly onChange?: () => void;
    readonly serverUpdate?: boolean;
}

interface FileMetaEditorState {
    readonly files: FilezFile[] | null;
    readonly knownMimeTypes: string[];
    readonly knownOwners: ItemDataType[];
}

export default class FileMetaEditor extends PureComponent<
    FileMetaEditorProps,
    FileMetaEditorState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: FileMetaEditorProps) {
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

    componentDidUpdate = async (prevProps: Readonly<FileMetaEditorProps>) => {
        if (!isEqual(prevProps.fileIds, this.props.fileIds)) {
            await this.loadFileInfos();
        }
    };

    loadFileInfos = async () => {
        if (!this.context) return;

        const files = await this.context.filezClient.get_file_infos(
            this.props.fileIds
        );

        this.setState({
            files
        });
    };

    onChange = async () => {
        this.props.onChange?.();
    };

    getKnownStorageOptions = async () => {
        if (!this.context) return [];
        const res = await this.context.filezClient.get_users();
        const own_user = res.full_users?.[0];
        if (own_user === undefined || own_user.limits === null) return [];

        const availableStorages: StorageOptions[] = [];
        for (const [storage_id, user_storage_limits] of Object.entries(
            own_user.limits
        )) {
            if (user_storage_limits === null) continue;
            if (
                user_storage_limits.used_storage >=
                user_storage_limits.max_storage
            )
                continue;
            availableStorages.push({
                storage_id,
                limits: user_storage_limits
            });
        }
        const options: TagData[] = availableStorages.map((storageOption) => ({
            value: storageOption.storage_id,
            label: `${storageOption.storage_id} (${bytesToHumanReadableSize(
                storageOption.limits.used_storage
            )} / ${bytesToHumanReadableSize(
                storageOption.limits.max_storage
            )} used)`
        }));

        return options;
    };

    render = () => {
        if (this.state.files === null) {
            return;
        }
        const inputSize = "sm";

        const singleFile =
            this.state.files.length === 1 ? this.state.files[0] : null;

        return (
            <div
                style={{ ...this.props.style }}
                className="Filez FileMetaEditor"
            >
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
                                    <Name
                                        file={singleFile}
                                        inputSize={inputSize}
                                        serverUpdate={this.props.serverUpdate}
                                        onCommitNameChange={this.onChange}
                                    />
                                </div>
                            )}
                            <div className="basicsBox">
                                <label>Static File Groups</label>
                                <StaticFileGroupPicker
                                    size={inputSize}
                                    resources={this.state.files}
                                    serverUpdate={this.props.serverUpdate}
                                    onChange={this.onChange}
                                />
                            </div>
                            <div className="basicsBox">
                                <label>Keywords</label>
                                <KeywordPicker
                                    resourceType="File"
                                    resources={this.state.files}
                                    inputSize={inputSize}
                                    onChange={this.onChange}
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
                                        data={this.state.knownMimeTypes.map(
                                            (mimeType) => ({
                                                value: mimeType,
                                                label: mimeType
                                            })
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                        {singleFile && (
                            <div className="basicsBox">
                                <div className="created">
                                    <label>Created</label>
                                    {utcTimeStampToTimeAndDate(
                                        singleFile.created
                                    )}
                                </div>
                                <div className="modified">
                                    <label>Modified</label>

                                    {singleFile.modified !== null &&
                                        utcTimeStampToTimeAndDate(
                                            singleFile.modified
                                        )}
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
                            onChange={this.onChange}
                            fileIds={this.props.fileIds}
                        />
                    </Panel>

                    <Panel
                        className="panel"
                        collapsible
                        header={
                            <div className="header">
                                <span className="icon">
                                    <BiLink
                                        size={18}
                                        style={{
                                            transform:
                                                "translate(0px,2px) scale(1.3)"
                                        }}
                                    />
                                </span>
                                <span>Linked Files</span>
                            </div>
                        }
                        bordered
                    />
                    <Panel
                        className="panel"
                        collapsible
                        header={
                            <div className="header">
                                <span className="icon">
                                    <BiHistory
                                        size={18}
                                        style={{
                                            transform:
                                                "translate(0px,3px) scale(1.1)"
                                        }}
                                    />
                                </span>
                                <span>History</span>
                            </div>
                        }
                        bordered
                    />
                </PanelGroup>
            </div>
        );
    };
}

// TODO create a user defined panel with the fields they want to see
