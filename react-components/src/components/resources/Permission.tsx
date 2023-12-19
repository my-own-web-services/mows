import { ChangeEvent, PureComponent, SyntheticEvent } from "react";
import {
    Button,
    CheckPicker,
    CheckTreePicker,
    Checkbox,
    Input,
    InputGroup,
    InputPicker
} from "rsuite";
import { FilezContext } from "../../FilezProvider";
import EyeIcon from "@rsuite/icons/legacy/Eye";
import EyeSlashIcon from "@rsuite/icons/legacy/EyeSlash";
import { BiCopy } from "react-icons/bi";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { match } from "ts-pattern";
import { ValueType } from "rsuite/esm/Checkbox";
import { FilezPermissionAcl } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermissionAcl";

type PermissionResourceType = "File" | "FileGroup" | "User" | "UserGroup";

interface PermissionProps {
    readonly readonly?: boolean;
    readonly itemId?: string;
    readonly size?: "lg" | "md" | "sm" | "xs";
    readonly permission?: FilezPermission;
    readonly permissionType?: PermissionResourceType;
    readonly disableTypeChange?: boolean;
    readonly hideTypeChanger?: boolean;
    readonly useOnce?: boolean;
    readonly onChange?: (permission: FilezPermission) => void;
    readonly onSave?: (permissionId: string) => void;
    readonly disableSaveButton?: boolean;
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
    readonly permissionType: PermissionResourceType;
    readonly permissionId: string | null;
}

export default class Permission extends PureComponent<
    PermissionProps,
    PermissionState
> {
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
            enabledPassword:
                maybePw !== null && maybePw !== undefined && maybePw.length > 0,
            passwords: acl?.who.passwords ?? [],
            passwordVisible: false,
            selectedUserIds: acl?.who.users?.user_ids ?? [],
            selectedUserGroupIds: acl?.who.users?.user_group_ids ?? [],
            permissionType: type ?? props.permissionType ?? "File",
            permissionId: props.permission?._id ?? null
        };
    }

    onChange = () => {
        const permission: FilezPermission = {
            _id: this.state.permissionId ?? "",
            name: this.state.name,
            use_type: "Multiple",
            content: {
                type: this.state.permissionType,
                acl: {
                    who: {
                        link: this.state.enabledLink,
                        passwords: this.state.passwords,
                        users: {
                            user_ids: this.state.selectedUserIds,
                            user_group_ids: this.state.selectedUserGroupIds
                        }
                    },
                    //@ts-ignore
                    what: this.state.selectedWhat
                }
            }
        };
        this.props.onChange?.(permission);
    };

    updatePermissionType = (value: string) => {
        this.setState(
            {
                permissionType: value as PermissionResourceType,
                selectedWhat: []
            },
            this.onChange
        );
    };

    onNameChange = (value: string) => {
        this.setState({ name: value }, this.onChange);
    };

    onEnableLinkChange = (
        value: ValueType | undefined,
        checked: boolean,
        event: ChangeEvent<HTMLInputElement>
    ) => {
        this.setState(
            {
                enabledLink: checked,
                enabledPassword:
                    checked === false ? false : this.state.enabledPassword
            },
            this.onChange
        );
    };

    onEnablePasswordChange = (
        value: ValueType | undefined,
        checked: boolean,
        event: ChangeEvent<HTMLInputElement>
    ) => {
        this.setState(
            { enabledPassword: checked, enabledLink: checked },
            this.onChange
        );
    };

    onCopyLinkClick = () => {
        navigator.clipboard.writeText(
            `${window.location.origin}?f=${this.props.itemId}`
        );
    };

    onPasswordChange = (value: string) => {
        this.setState({ passwords: [value] }, this.onChange);
    };

    onPasswordVisibleClick = () => {
        this.setState(
            { passwordVisible: !this.state.passwordVisible },
            this.onChange
        );
    };

    onWhatChange = (
        permissions: string[],
        event: SyntheticEvent<Element, Event>
    ) => {
        permissions = permissions.flatMap((p) => {
            return match(this.state.permissionType)
                .with("File", () => {
                    if (p === "Get") {
                        return [
                            "GetFile",
                            "GetFileDerivatives",
                            "GetFileInfos"
                        ];
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
        this.setState(
            {
                selectedWhat: permissions as string[]
            },
            this.onChange
        );
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
            name,
            permissionId
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
            _id: permissionId,
            //@ts-ignore
            content: {
                type: permissionType,
                acl
            },
            use_type: this.props.useOnce === true ? "Once" : "Multiple"
        });

        return res.permission_id;
    };

    handleSave = async () => {
        const res = await this.saveData();
        if (typeof res === "string") {
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
                            <>
                                <label>ResourceType</label>
                                <br />
                                <InputPicker
                                    cleanable={false}
                                    data={[
                                        "File",
                                        "FileGroup",
                                        "User",
                                        "UserGroup"
                                    ].map((v) => {
                                        return { label: v, value: v };
                                    })}
                                    value={this.state.permissionType}
                                    onChange={this.updatePermissionType}
                                    size={this.props.size}
                                    defaultValue={this.state.permissionType}
                                    readOnly={
                                        this.props.readonly ??
                                        this.props.useOnce ??
                                        this.props.disableTypeChange
                                    }
                                />
                            </>
                        )}
                    </div>
                    {this.props.useOnce !== true && (
                        <div>
                            <label>Name</label>
                            <Input
                                value={this.state.name}
                                onChange={this.onNameChange}
                                size={this.props.size}
                                placeholder="Name"
                                disabled={this.props.readonly}
                            />
                        </div>
                    )}
                    <div style={{ display: "inline-block", width: "50%" }}>
                        <label>Everyone with the Link</label>
                        <Checkbox
                            checked={this.state.enabledLink}
                            style={{ display: "inline-block" }}
                            onChange={this.onEnableLinkChange}
                        />
                        <InputGroup
                            size={this.props.size}
                            style={{
                                width: inputWidths,
                                display: "inline-block"
                            }}
                            inside
                        >
                            <Input
                                readOnly
                                value={link}
                                disabled={!this.state.enabledLink}
                            />
                            <InputGroup.Button
                                disabled={!this.state.enabledLink}
                                onClick={this.onCopyLinkClick}
                            >
                                <BiCopy />
                            </InputGroup.Button>
                        </InputGroup>
                    </div>
                    <div style={{ display: "inline-block", width: "50%" }}>
                        <label>and Password</label>
                        <Checkbox
                            checked={this.state.enabledPassword}
                            onChange={this.onEnablePasswordChange}
                            style={{ display: "inline-block" }}
                        />

                        <InputGroup
                            style={{
                                width: inputWidths,
                                display: "inline-block"
                            }}
                            inside
                            size={this.props.size}
                        >
                            <Input
                                placeholder="Password"
                                type={
                                    this.state.passwordVisible
                                        ? "text"
                                        : "password"
                                }
                                value={this.state.passwords[0]}
                                onChange={this.onPasswordChange}
                                disabled={!this.state.enabledPassword}
                            />
                            <InputGroup.Button
                                onClick={this.onPasswordVisibleClick}
                            >
                                {this.state.passwordVisible ? (
                                    <EyeIcon />
                                ) : (
                                    <EyeSlashIcon />
                                )}
                            </InputGroup.Button>
                        </InputGroup>
                    </div>
                </div>
                <div>
                    <label>and the following users</label>
                    <CheckPicker
                        placeholder="nobody"
                        groupBy="type"
                        size={this.props.size}
                        block
                        virtualized
                        data={[]}
                    />
                    <label>and user groups</label>
                    <CheckPicker
                        placeholder="nobody"
                        groupBy="type"
                        size={this.props.size}
                        block
                        virtualized
                        data={[]}
                    />
                </div>

                <label>can</label>
                <CheckTreePicker
                    placeholder="do nothing"
                    block
                    value={this.state.selectedWhat}
                    size={this.props.size}
                    defaultExpandAll
                    data={match(this.state.permissionType)
                        .with("File", () => filePermissionTreeData)
                        .with("FileGroup", () => fileGroupPermissionTreeData)
                        .with("User", () => userPermissionTreeData)
                        .with("UserGroup", () => userGroupPermissionTreeData)
                        .exhaustive()}
                    // @ts-ignore
                    onChange={this.onWhatChange}
                />
                {this.props.readonly !== true &&
                    this.props.disableSaveButton !== true && (
                        <Button
                            onClick={this.handleSave}
                            size={this.props.size}
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

const userPermissionTreeData = [
    {
        label: "Get",
        value: "GetUser"
    }
];
const userGroupPermissionTreeData = [
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
                label: "Visibility",
                value: "UpdateGroupInfosVisibility"
            }
        ]
    },
    {
        label: "Delete",
        value: "DeleteGroup"
    }
];

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
        value: "DeleteFile"
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
