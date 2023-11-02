import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { PureComponent } from "react";
import Permission from "../permissions/Permission";
import { FilezContext } from "../../../FilezProvider";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { cloneDeep } from "lodash";
import { Checkbox, Input, Uploader } from "rsuite";
import { FileType } from "rsuite/esm/Uploader";
import update from "immutability-helper";
import Keywords from "../../metaEditor/KeywordPicker";
interface FileProps {
    readonly file?: FilezFile;
    readonly oncePermissionRef?: React.RefObject<Permission>;
}

interface FileState {
    readonly serverFile: FilezFile;
    readonly clientFile: FilezFile;
    readonly availablePermissions?: FilezPermission[];
    readonly useOncePermissionEnabled: boolean;
    readonly newFile: boolean;
    readonly fileList: FileTypeExt[];
    readonly addToUploadGroup: boolean;
    readonly uploadGroupName: string;
    readonly keywords: string[];
}

interface FileTypeExt extends FileType {
    fileTypeOverride: string;
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
    path: "",
    pending_new_owner_id: "",
    permission_ids: [],
    readonly: false,
    server_created: 0,
    sha256: "",
    size: 0,
    static_file_group_ids: [],
    storage_id: "",
    time_of_death: 0
};

export default class File extends PureComponent<FileProps, FileState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: FileProps) {
        super(props);
        const file = props.file ?? defaultFile;

        const time = new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: false
        }).format(new Date());

        this.state = {
            clientFile: cloneDeep(file),
            serverFile: cloneDeep(file),
            useOncePermissionEnabled: false,
            newFile: file._id === "",
            fileList: [],
            addToUploadGroup: true,
            uploadGroupName: `upload-${time}`,
            keywords: []
        };
    }

    componentDidMount = async () => {
        if (!this.context) return;
        let { items } = await this.context.filezClient.get_own_permissions({
            filter: "",
            limit: null,
            from_index: 0,
            sort_field: "name",
            sort_order: "Ascending"
        });

        items = items?.filter(p => p.content.type === "File");

        if (items) {
            const useOncePermission = items?.find(p => {
                if (this.state.clientFile.permission_ids.includes(p._id) && p.use_type === "Once") {
                    return p;
                }
            });
            console.log(useOncePermission);

            this.setState({
                availablePermissions: items,
                useOncePermissionEnabled: useOncePermission !== undefined
            });
        }
    };

    create = async (useOncePermissionId?: string) => {
        if (!this.context) return false;

        const cf = this.state.clientFile;

        if (cf._id === "") {
            const permission_ids = cloneDeep(cf.permission_ids);
            if (useOncePermissionId) {
                permission_ids.push(useOncePermissionId);
            }
            const file = "";
            const res = await this.context.filezClient.create_file(file, {
                created: cf.created,
                modified: cf.modified,
                name: cf.name,
                mime_type: cf.mime_type,
                static_file_group_ids: cf.static_file_group_ids,
                storage_id: cf.storage_id
            });
            if (res.status === 201) {
                this.setState({ serverFile: cf });
                return true;
            }
        }

        return false;
    };

    render = () => {
        return (
            <div className="File">
                {this.state.newFile ? (
                    <div>
                        <Uploader
                            fileList={this.state.fileList}
                            shouldUpload={() => false}
                            onChange={v => {
                                console.log(v);

                                this.setState(
                                    update(this.state, {
                                        fileList: {
                                            $set: v.map(f => {
                                                return {
                                                    ...f,
                                                    fileTypeOverride: f.blobFile?.type ?? ""
                                                };
                                            })
                                        }
                                    })
                                );
                            }}
                            action=""
                            autoUpload={false}
                            multiple
                            draggable
                            renderFileInfo={file => {
                                console.log(file);

                                return (
                                    <div>
                                        <Input
                                            placeholder="File Name"
                                            size="xs"
                                            value={file.name}
                                            onChange={value => {
                                                const key = file.fileKey;
                                                this.setState(
                                                    update(this.state, {
                                                        fileList: {
                                                            $set: this.state.fileList.map(f => {
                                                                if (f.fileKey === key) {
                                                                    f.name = value;
                                                                }
                                                                return f;
                                                            })
                                                        }
                                                    })
                                                );
                                            }}
                                        />
                                    </div>
                                );
                            }}
                        >
                            <div
                                style={{
                                    height: 100,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer"
                                }}
                            >
                                <span>Click or Drag files to this area to upload</span>
                            </div>
                        </Uploader>
                        <div>
                            <span>Add to Upload Group</span>
                            <Checkbox
                                checked={this.state.addToUploadGroup}
                                onChange={(_, checked) => {
                                    this.setState({ addToUploadGroup: checked });
                                }}
                            />
                            <Input
                                disabled={!this.state.addToUploadGroup}
                                placeholder="Upload Group Name"
                                value={this.state.uploadGroupName}
                                onChange={value => {
                                    this.setState({
                                        uploadGroupName: value
                                    });
                                }}
                            />
                        </div>
                        <div>
                            <Keywords
                                resourceType="File"
                                onKeywordsChanged={(keywords: string[]) => {
                                    this.setState({ keywords: keywords });
                                }}
                            />
                        </div>
                        <div></div>
                    </div>
                ) : (
                    <div></div>
                )}
            </div>
        );
    };
}
