import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { CSSProperties, PureComponent } from "react";
import Permission from "../permissions/Permission";
import { FilezContext } from "../../../FilezProvider";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { cloneDeep } from "lodash";
import { Checkbox, Input, Progress } from "rsuite";
import update from "immutability-helper";
import Keywords from "../../metaEditor/KeywordPicker";
import StoragePicker from "../../metaEditor/StoragePicker";
import { AutoSizer } from "rsuite/esm/Windowing";
import { FixedSizeList, ListProps } from "react-window";
import { ValueType } from "rsuite/esm/Checkbox";
import { MultiItemTagPickerResources } from "../../metaEditor/MultiItemTagPicker";

interface UploadFileProps {
    readonly type: "create" | "edit";
    readonly files?: FilezFile[];
    readonly oncePermissionRef?: React.RefObject<Permission>;
}

interface UploadFileState {
    readonly availablePermissions?: FilezPermission[];
    readonly useOncePermissionEnabled: boolean;
    readonly fileList: BrowserFile[];
    readonly addToUploadGroup: boolean;
    readonly uploadGroupName: string;
    readonly keywords: string[];
    readonly selectedStorageId: string | null;
    readonly uploading: boolean;
}

interface BrowserFile {
    type: string;
    name: string;
    size: number;
    readonly originalFileName: string;
    blobFile: File;
    uploadStatus: "success" | "fail" | "active" | undefined;
    uploadedSize: number;
    xhr?: XMLHttpRequest;
}

const defaultFile: FilezFile = {
    _id: "",
    name: "",
    accessed: 0,
    created: 0,
    modified: 0,
    accessed_count: 0,
    app_data: {},
    dynamic_file_group_ids: [],
    keywords: [],
    mime_type: "",
    owner_id: "",
    pending_new_owner_id: "",
    permission_ids: [],
    readonly: false,
    server_created: 0,
    sha256: "",
    size: 0,
    static_file_group_ids: [],
    storage_id: "",
    time_of_death: 0,
    readonly_path: null
};

export interface ListItemProps {
    index: number;
    style: CSSProperties;
    data: {
        items: BrowserFile[];
        disabled: boolean;
        handlers: {
            updateName: InstanceType<typeof UploadFile>["updateName"];
        };
    };
}

const ItemRenderer = (props: ListItemProps) => {
    const { index, style, data } = props;
    const file = data.items[index];
    return (
        <div style={style}>
            <Input
                style={{
                    display: "block",
                    width: "50%",
                    height: "100%",
                    float: "left"
                }}
                data-index={index}
                placeholder="Name"
                disabled={data.disabled}
                size="sm"
                value={file.name}
                onChange={data.handlers.updateName}
            />
            <Progress.Line
                style={{ width: "45%", float: "left", overflow: "hidden" }}
                percent={parseFloat(((file.uploadedSize / file.size) * 100).toFixed(2))}
                status={file.uploadStatus}
            />
        </div>
    );
};

export default class UploadFile extends PureComponent<UploadFileProps, UploadFileState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    uploadXhrs: XMLHttpRequest[] = [];
    constructor(props: UploadFileProps) {
        super(props);

        const time = new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: false
        }).format(new Date());

        this.state = {
            useOncePermissionEnabled: false,
            fileList: [],
            addToUploadGroup: true,
            uploadGroupName: `upload-${time}`,
            keywords: [],
            selectedStorageId: null,
            uploading: false
        };
    }

    componentDidMount = async () => {};

    componentWillUnmount = async () => {
        this.uploadXhrs.forEach(xhr => {
            xhr?.abort();
        });
    };

    create = async (useOncePermissionId?: string) => {
        if (!this.context) return false;
        if (this.state.uploading) return false;

        // TODO calculate remaining time and show it
        // TODO show total progress bar
        // TODO show upload speed
        // TODO this should create the upload group for the files

        const uploadGroupRes = await this.context.filezClient.create_file_group({
            dynamic_group_rules: null,
            group_hierarchy_paths: [],
            group_type: "Static",
            keywords: this.state.keywords,
            name: this.state.uploadGroupName,
            permission_ids: [],
            mime_types: []
        });

        const { group_id } = uploadGroupRes;

        for (const file of this.state.fileList) {
            if (!file.blobFile) continue;
            const filezFile: FilezFile = cloneDeep(defaultFile);
            filezFile.name = file.name ?? "";
            filezFile.mime_type = file.blobFile?.type ?? "application/octet-stream";
            filezFile.keywords = this.state.keywords;
            filezFile.storage_id = this.state.selectedStorageId;
            filezFile.permission_ids = [];
            filezFile.size = file.blobFile.size;
            filezFile.modified = file.blobFile.lastModified / 1000;
            filezFile.static_file_group_ids = [group_id];
            if (useOncePermissionId) {
                filezFile.permission_ids.push(useOncePermissionId);
            }

            this.setState({
                uploading: true,
                fileList: update(this.state.fileList, {
                    $set: this.state.fileList.map(f => {
                        if (f.name === file.name) {
                            f.uploadStatus = "active";
                        }
                        return f;
                    })
                })
            });

            const { success, xhr } =
                await this.context.filezClient.create_file_with_upload_progress(
                    file.blobFile,
                    filezFile,
                    (uploadedBytes: number) => {
                        this.setState(
                            update(this.state, {
                                fileList: {
                                    $set: this.state.fileList.map(f => {
                                        if (f.name === file.name) {
                                            f.uploadedSize = uploadedBytes;
                                        }
                                        return f;
                                    })
                                }
                            })
                        );
                    },
                    err => {
                        this.setState({
                            fileList: update(this.state.fileList, {
                                $set: this.state.fileList.map(f => {
                                    if (f.name === file.name) {
                                        f.uploadStatus = "fail";
                                    }
                                    return f;
                                })
                            })
                        });
                    }
                );

            this.uploadXhrs.push(xhr);
            await success;
            this.setState({
                fileList: update(this.state.fileList, {
                    $set: this.state.fileList.map(f => {
                        if (f.name === file.name) {
                            f.uploadStatus = "success";
                        }
                        return f;
                    })
                })
            });
        }

        this.setState({ uploading: false });

        return true;
    };

    updateName = (value: string, event: any) => {
        const index = parseInt(event.target.dataset.index);

        this.setState(() => {
            return update(this.state, {
                fileList: {
                    [index]: {
                        name: {
                            $set: value
                        }
                    }
                }
            });
        });
    };

    updatePickedFiles = (event: any) => {
        if (!event?.target?.files) return;

        const fileList: BrowserFile[] = [];
        for (const file of event.target.files) {
            fileList.push({
                blobFile: file,
                type: file.type,
                name: file.name,
                originalFileName: file.name,
                uploadStatus: "active",
                size: file.size,
                uploadedSize: 0
            });
        }
        this.setState({ fileList });
    };

    updateCheckUploadGroup = (
        value: ValueType | undefined,
        checked: boolean,
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        this.setState({ addToUploadGroup: checked });
    };

    updateUploadGroupName = (value: string, event: any) => {
        this.setState({ uploadGroupName: value });
    };

    onKeywordsChange = (resources: MultiItemTagPickerResources) => {
        this.setState({ keywords: resources.default });
    };

    updateSelectedStorageId = (storage_id: string) => {
        this.setState(
            update(this.state, {
                selectedStorageId: {
                    $set: storage_id
                }
            })
        );
    };

    render = () => {
        return (
            <div className="UploadFile">
                {this.props.type === "create" ? (
                    <div>
                        <input
                            disabled={this.state.uploading}
                            className={this.state.uploading ? "disabled" : ""}
                            type="file"
                            id="file-upload"
                            multiple
                            onChange={this.updatePickedFiles}
                        />
                        <br />
                        <br />
                        <div style={{ width: "100%", height: "200px" }} className="UploadFileList">
                            <AutoSizer>
                                {({ height, width }) => {
                                    return (
                                        <FixedSizeList
                                            height={height}
                                            width={width}
                                            itemSize={30}
                                            itemCount={this.state.fileList.length}
                                            itemData={{
                                                items: this.state.fileList,
                                                disabled: this.state.uploading,
                                                handlers: { updateName: this.updateName }
                                            }}
                                        >
                                            {ItemRenderer}
                                        </FixedSizeList>
                                    );
                                }}
                            </AutoSizer>
                        </div>

                        <div>
                            <span className={this.state.uploading ? "disabled" : ""}>
                                Add to Upload Group
                            </span>
                            <Checkbox
                                disabled={this.state.uploading}
                                checked={this.state.addToUploadGroup}
                                onChange={this.updateCheckUploadGroup}
                            />
                            <Input
                                disabled={!this.state.addToUploadGroup || this.state.uploading}
                                placeholder="Upload Group Name"
                                value={this.state.uploadGroupName}
                                onChange={this.updateUploadGroupName}
                            />
                        </div>
                        <div>
                            <label htmlFor="">Keywords</label>
                            <Keywords
                                disabled={this.state.uploading}
                                resourceType="File"
                                onChange={this.onKeywordsChange}
                                serverUpdate={false}
                                resources={[{ _id: "default", keywords: [] }]}
                            />
                        </div>
                        <div>
                            <StoragePicker
                                disabled={this.state.uploading}
                                onChange={this.updateSelectedStorageId}
                            />
                        </div>
                    </div>
                ) : (
                    <div></div>
                )}
            </div>
        );
    };
}
