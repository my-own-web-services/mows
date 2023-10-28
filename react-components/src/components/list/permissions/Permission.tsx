import { PureComponent } from "react";
import {
    Button,
    CheckPicker,
    CheckTreePicker,
    Checkbox,
    Input,
    InputGroup,
    InputPicker
} from "rsuite";
import { FilezContext } from "../../../FilezProvider";
import EyeIcon from "@rsuite/icons/legacy/Eye";
import EyeSlashIcon from "@rsuite/icons/legacy/EyeSlash";
import { BiCopy } from "react-icons/bi";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { match } from "ts-pattern";
import { FilezPermissionAcl } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermissionAcl";

interface PermissionProps {
    readonly readonly?: boolean;
    readonly itemId?: string;
    readonly inputSize?: "lg" | "md" | "sm" | "xs";
    readonly permission?: FilezPermission;
    readonly permissionType?: "File" | "FileGroup" | "User" | "UserGroup";
    readonly disableSaveButton?: boolean;
    readonly disableTypeChange?: boolean;
    readonly hideTypeChanger?: boolean;
    readonly onSave?: (permissionId: string) => void;
}

interface PermissionState {
    readonly name: string;
    readonly selectedWhat: string[];
    readonly enabledLink: boolean;
    readonly enabledPassword: boolean;
    readonly passwords: string[];
    readonly passwordVisible: boolean;
    readonly selectedUserIds: string[];
    readonly selectedUserGroupIds: string[];
    readonly permissionType: "File" | "FileGroup" | "User" | "UserGroup";
}

export default class Permission extends PureComponent<PermissionProps, PermissionState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: PermissionProps) {
        super(props);

        const acl = props.permission?.content?.acl;
        const type = props.permission?.content.type;

        const maybePw = acl?.who.passwords;

        this.state = {
            name: props.permission?.name ?? "",
            selectedWhat: acl?.what ?? [],
            enabledLink: acl?.who.link ?? false,
            enabledPassword: maybePw !== null && maybePw !== undefined && maybePw.length > 0,
            passwords: acl?.who.passwords ?? [],
            passwordVisible: false,
            selectedUserIds: acl?.who.users?.user_ids ?? [],
            selectedUserGroupIds: acl?.who.users?.user_group_ids ?? [],
            permissionType: type ?? props.permissionType ?? "File"
        };
    }

    componentDidMount = async () => {
        if (!this.context) return;
    };

    saveData = async () => {
        if (!this.context) return;
        const {
            selectedWhat,
            enabledLink,
            enabledPassword,
            passwords,
            permissionType,
            selectedUserIds,
            selectedUserGroupIds,
            name
        } = this.state;

        const acl: FilezPermissionAcl<any> = {
            what: selectedWhat,
            who: {
                link: enabledLink,
                passwords: enabledPassword ? passwords : null,
                users: {
                    user_ids: selectedUserIds,
                    user_group_ids: selectedUserGroupIds
                }
            }
        };

        const res = await this.context.filezClient.update_permission({
            name,
            permission_id: this.props.itemId,
            //@ts-ignore
            content: {
                type: permissionType,
                acl
            },
            use_type: "Multiple"
        });

        return res.permission_id;
    };

    handleSave = async () => {
        const res = await this.saveData();
        if (res) {
            this.props.onSave?.(res);
        }
    };

    render = () => {
        const link = `${window.location.origin}?f=${this.props.itemId}`;
        const inputWidths = "80%";
        return (
            <div className="Permission">
                <div style={{ marginBottom: "5px" }}>
                    <div>
                        {this.props.hideTypeChanger !== true && (
                            <InputPicker
                                data={["File", "FileGroup", "User", "UserGroup"].map(v => {
                                    return { label: v, value: v };
                                })}
                                value={this.state.permissionType}
                                onChange={value => {
                                    this.setState({ permissionType: value, selectedWhat: [] });
                                }}
                                size={this.props.inputSize}
                                readOnly={this.props.readonly ?? this.props.disableTypeChange}
                            />
                        )}
                    </div>
                    <div>
                        <label>Name</label>
                        <Input
                            value={this.state.name}
                            onChange={value => {
                                this.setState({ name: value });
                            }}
                            size={this.props.inputSize}
                            placeholder="Name"
                            disabled={this.props.readonly}
                        />
                    </div>
                    <div style={{ display: "inline-block", width: "50%" }}>
                        <label>Everyone with the Link</label>
                        <Checkbox
                            checked={this.state.enabledLink}
                            style={{ display: "inline-block" }}
                            onChange={(_value, checked) => {
                                this.setState({ enabledLink: checked });
                            }}
                        />
                        <InputGroup
                            size={this.props.inputSize}
                            style={{ width: inputWidths, display: "inline-block" }}
                            inside
                        >
                            <Input readOnly value={link} disabled={!this.state.enabledLink} />
                            <InputGroup.Button
                                disabled={!this.state.enabledLink}
                                onClick={() => {
                                    navigator.clipboard.writeText(link);
                                }}
                            >
                                <BiCopy />
                            </InputGroup.Button>
                        </InputGroup>
                    </div>
                    <div style={{ display: "inline-block", width: "50%" }}>
                        <label>and Password</label>
                        <Checkbox
                            checked={this.state.enabledPassword}
                            onChange={(_value, checked) => {
                                this.setState({ enabledPassword: checked, enabledLink: checked });
                            }}
                            style={{ display: "inline-block" }}
                        />

                        <InputGroup
                            style={{ width: inputWidths, display: "inline-block" }}
                            inside
                            size={this.props.inputSize}
                        >
                            <Input
                                placeholder="Password"
                                type={this.state.passwordVisible ? "text" : "password"}
                                value={this.state.passwords[0]}
                                onChange={value => {
                                    this.setState({ passwords: [value] });
                                }}
                                disabled={!this.state.enabledPassword}
                            />
                            <InputGroup.Button
                                onClick={() => {
                                    this.setState({ passwordVisible: !this.state.passwordVisible });
                                }}
                            >
                                {this.state.passwordVisible ? <EyeIcon /> : <EyeSlashIcon />}
                            </InputGroup.Button>
                        </InputGroup>
                    </div>
                </div>
                <div>
                    <label>and the following users</label>
                    <CheckPicker
                        placeholder="nobody"
                        groupBy="type"
                        size={this.props.inputSize}
                        block
                        virtualized
                        data={[]}
                    />
                    <label>and user groups</label>
                    <CheckPicker
                        placeholder="nobody"
                        groupBy="type"
                        size={this.props.inputSize}
                        block
                        virtualized
                        data={[]}
                    />
                </div>

                <label>can</label>
                <CheckTreePicker
                    placeholder="do nothing"
                    block
                    size={this.props.inputSize}
                    defaultExpandAll
                    data={match(this.state.permissionType)
                        .with("File", () => filePermissionTreeData)
                        .with("FileGroup", () => fileGroupPermissionTreeData)
                        .with("User", () => userPermissionTreeData)
                        .with("UserGroup", () => userGroupPermissionTreeData)
                        .exhaustive()}
                    onChange={permissions => {
                        permissions = permissions.flatMap(p => {
                            return match(this.state.permissionType)
                                .with("File", () => {
                                    if (p === "Get") {
                                        return ["GetFile", "GetFileDerivatives", "GetFileInfos"];
                                    } else if (p === "UpdateMeta") {
                                        return [
                                            "UpdateFileInfosName",
                                            "UpdateFileInfosMimeType",
                                            "UpdateFileInfosKeywords",
                                            "UpdateFileInfosStaticFileGroups"
                                        ];
                                    } else {
                                        return p;
                                    }
                                })
                                .with("FileGroup", () => {
                                    if (p === "UpdateGroupInfos") {
                                        return [
                                            "UpdateGroupInfosName",
                                            "UpdateGroupInfosKeywords",
                                            "UpdateGroupInfosDynamicGroupRules"
                                        ];
                                    } else {
                                        return p;
                                    }
                                })
                                .with("User", () => {
                                    return p;
                                })
                                .with("UserGroup", () => {
                                    return p;
                                })
                                .exhaustive();
                        });
                        console.log(permissions);
                    }}
                />
                {this.props.readonly !== true && this.props.disableSaveButton !== true && (
                    <Button
                        onClick={this.handleSave}
                        size={this.props.inputSize}
                        style={{ marginTop: "10px" }}
                        appearance="primary"
                        disabled={this.props.readonly}
                    >
                        Save
                    </Button>
                )}
            </div>
        );
    };
}

const userPermissionTreeData = [{}];
const userGroupPermissionTreeData = [{}];

const fileGroupPermissionTreeData = [
    {
        label: "List Files",
        value: "ListFiles"
    },
    {
        label: "Get Infos",
        value: "GetGroupInfos"
    },
    {
        label: "Update Infos",
        value: "UpdateGroupInfos",
        children: [
            {
                label: "Name",
                value: "UpdateGroupInfosName"
            },
            {
                label: "Keywords",
                value: "UpdateGroupInfosKeywords"
            },
            {
                label: "Dynamic Group Rules",
                value: "UpdateGroupInfosDynamicGroupRules"
            }
        ]
    },
    {
        label: "Delete",
        value: "DeleteGroup"
    }
];

const filePermissionTreeData = [
    {
        label: "Read",
        value: "Get",
        children: [
            {
                label: "File",
                value: "GetFile"
            },
            {
                label: "File Derivatives",
                value: "GetFileDerivatives"
            },
            {
                label: "File Metadata",
                value: "GetFileInfos"
            }
        ]
    },
    {
        label: "Delete File",
        value: "Delete"
    },
    {
        label: "Update Metadata",
        value: "UpdateMeta",
        children: [
            {
                label: "Filename",
                value: "UpdateFileInfosName"
            },
            {
                label: "File Mime Type",
                value: "UpdateFileInfosMimeType"
            },
            {
                label: "File Keywords",
                value: "UpdateFileInfosKeywords"
            },
            {
                label: "Static Filegroups",
                value: "UpdateFileInfosStaticFileGroups"
            }
        ]
    },
    {
        label: "Update File",
        value: "UpdateFile"
    }
];
