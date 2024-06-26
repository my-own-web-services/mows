import { ChangeEvent, PureComponent, SyntheticEvent } from "react";
import {
    Button,
    CheckTreePicker,
    Checkbox,
    Input,
    InputGroup,
    InputPicker,
    Modal
} from "rsuite";
import { FilezContext } from "../../FilezProvider";
import EyeIcon from "@rsuite/icons/legacy/Eye";
import EyeSlashIcon from "@rsuite/icons/legacy/EyeSlash";
import { BiCopy } from "react-icons/bi";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { match } from "ts-pattern";
import { ValueType } from "rsuite/esm/Checkbox";
import { FilezPermissionAcl } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermissionAcl";
import ResourcePicker from "../atoms/ResourcePicker";
import { TagData } from "../atoms/MultiItemTagPicker";
import { RsuiteComponentSize } from "../../types";
import UserGroup from "./UserGroup";
import User from "./User";
import { cloneDeep } from "lodash";

type PermissionResourceType = "File" | "FileGroup" | "User" | "UserGroup";

interface PermissionProps {
    readonly readonly?: boolean;
    readonly itemId?: string;
    readonly size?: RsuiteComponentSize;
    readonly permission?: FilezPermission;
    readonly permissionType?: PermissionResourceType;
    readonly disableTypeChange?: boolean;
    readonly hideTypeChanger?: boolean;
    readonly useOnce?: boolean;
    readonly onChange?: (permission: FilezPermission) => void;
    readonly onCreateResourceSuccess?: (id: string) => void;
    readonly onCreateResourceAbort?: () => void;
    readonly creatable?: boolean;
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
            selectedUserIds: acl?.who?.user_ids ?? [],
            selectedUserGroupIds: acl?.who?.user_group_ids ?? [],
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
                        user_ids: this.state.selectedUserIds,
                        user_group_ids: this.state.selectedUserGroupIds
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
                    if (p === "FileGe") {
                        return [
                            "FileGet",
                            "FileGetDerivatives",
                            "FileGetInfos"
                        ];
                    } else if (p === "FileUpdateInfos") {
                        return [
                            "FileUpdateInfosName",
                            "FileUpdateInfosMimeType",
                            "FileUpdateInfosKeywords",
                            "FileUpdateInfosStaticFileGroups"
                        ];
                    } else {
                        return p;
                    }
                })
                .with("FileGroup", () => {
                    if (p === "FileGroupUpdateInfos") {
                        return [
                            "FileGroupUpdateInfosName",
                            "FileGroupUpdateInfosKeywords",
                            "FileGroupUpdateInfosDynamicGroupRules"
                        ];
                    } else if (p === "FileGe") {
                        return [
                            "FileGet",
                            "FileGetDerivatives",
                            "FileGetInfos"
                        ];
                    } else if (p === "FileUpdateInfos") {
                        return [
                            "FileUpdateInfosName",
                            "FileUpdateInfosMimeType",
                            "FileUpdateInfosKeywords",
                            "FileUpdateInfosStaticFileGroups"
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

    createPermission = async () => {
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
                user_ids: selectedUserIds,
                user_group_ids: selectedUserGroupIds
            }
        };

        const res = await this.context.filezClient.create_permission({
            name,
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
        const res = await this.createPermission();
        if (typeof res === "string") {
            this.props.onCreateResourceSuccess?.(res);
        }
    };

    onUserChange = (userIds: string[]) => {
        this.setState({ selectedUserIds: userIds }, this.onChange);
    };

    onUserGroupsChange = (userGroupIds: string[]) => {
        this.setState({ selectedUserGroupIds: userGroupIds }, this.onChange);
    };

    createResourceAbort = () => {
        this.props.onCreateResourceAbort?.();
    };

    getKnownUsers = async () => {
        if (!this.context) return [];
        const itemsRes = await this.context.filezClient.list_users();
        const knownItems: TagData[] = itemsRes.items.map((user) => {
            return {
                label: user.name ?? undefined,
                value: user._id
            };
        });
        return knownItems;
    };

    getKnownUserGroups = async () => {
        if (!this.context) return [];
        const itemsRes = await this.context.filezClient.list_user_groups();
        const knownItems: TagData[] = itemsRes.items.map((it) => {
            return {
                label: it.name ?? undefined,
                value: it._id
            };
        });
        return knownItems;
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
                        <label>Everyone with the Link/ID</label>
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
                    <ResourcePicker
                        mode="multi"
                        onMultiChange={this.onUserChange}
                        size={this.props.size}
                        getKnownTagsFunction={this.getKnownUsers}
                        initialMultiSelectedValues={
                            this.state.selectedUserIds ?? []
                        }
                        resourceType="User"
                        createResourceComponent={User}
                    />
                    <label>and user groups</label>
                    <ResourcePicker
                        mode="multi"
                        onMultiChange={this.onUserGroupsChange}
                        size={this.props.size}
                        getKnownTagsFunction={this.getKnownUserGroups}
                        initialMultiSelectedValues={
                            this.state.selectedUserGroupIds ?? []
                        }
                        resourceType="UserGroup"
                        createResourceComponent={UserGroup}
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
                    this.props.creatable === true && (
                        <Modal.Footer className="creatableButtons">
                            <Button
                                onClick={this.handleSave}
                                size={this.props.size}
                                appearance="primary"
                                disabled={this.props.readonly}
                            >
                                Create
                            </Button>
                            <Button onClick={this.createResourceAbort}>
                                Cancel
                            </Button>
                        </Modal.Footer>
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
        value: "UserGroupGetInfos"
    },
    {
        label: "Update Infos",
        value: "UserGroupUpdateInfos",
        children: [
            {
                label: "Name",
                value: "UserGroupUpdateInfosName"
            },
            {
                label: "Visibility",
                value: "UserGroupUpdateInfosVisibility"
            }
        ]
    },
    {
        label: "Delete",
        value: "UserGroupDelete"
    }
];

const filePermissionTreeData = [
    {
        label: "Get File",
        // this is correct: if the value is the same as the childrens we get an endless loop
        value: "FileGe",
        children: [
            {
                label: "Get Raw File",
                value: "FileGet"
            },
            {
                label: "Get File Derivatives",
                value: "FileGetDerivatives"
            },
            {
                label: "Get File Metadata",
                value: "FileGetInfos"
            }
        ]
    },
    {
        label: "List File",
        value: "FileList"
    },
    {
        label: "Delete File",
        value: "FileDelete"
    },
    {
        label: "Update Files Metadata",
        value: "FileUpdateInfos",
        children: [
            {
                label: "Update File Name",
                value: "FileUpdateInfosName"
            },
            {
                label: "Update File Mime Type",
                value: "FileUpdateInfosMimeType"
            },
            {
                label: "Update File Keywords",
                value: "FileUpdateInfosKeywords"
            },
            {
                label: "Update File StaticFileGroups",
                value: "FileUpdateInfosStaticFileGroups"
            }
        ]
    },
    {
        label: "Update File",
        value: "UpdateFile"
    }
];

const fileGroupPermissionTreeData = [
    {
        label: "FileGroup",
        value: "FileGroup",
        children: [
            {
                label: "List FileGroup",
                value: "FileGroupList"
            },
            {
                label: "Get FileGroup Infos",
                value: "FileGroupGetInfos"
            },
            {
                label: "Update FileGroup Infos",
                value: "FileGroupUpdateInfos",
                children: [
                    {
                        label: "Update FileGroup Name",
                        value: "FileGroupUpdateInfosName"
                    },
                    {
                        label: "Update FileGroup Keywords",
                        value: "FileGroupUpdateInfosKeywords"
                    }
                ]
            },
            {
                label: "Delete FileGroup",
                value: "FileGroupDelete"
            }
        ]
    },
    {
        label: "File",
        value: "File",
        children: cloneDeep(filePermissionTreeData)
    }
];
