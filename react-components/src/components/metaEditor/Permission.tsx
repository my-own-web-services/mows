import { FilezPermissionAclWhatOptions } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermissionAclWhatOptions";
import { PureComponent } from "react";
import { Button, CheckPicker, CheckTreePicker, Checkbox, Input, InputGroup } from "rsuite";
import { FilezContext } from "../../FilezProvider";
import EyeIcon from "@rsuite/icons/legacy/Eye";
import EyeSlashIcon from "@rsuite/icons/legacy/EyeSlash";
import { BiCopy } from "react-icons/bi";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";

interface PermissionProps {
    readonly readonly?: boolean;
    readonly fileId: string;
    readonly inputSize: "lg" | "md" | "sm" | "xs";
    readonly permission?: FilezPermission;
}

interface PermissionState {
    readonly selectedWhat: FilezPermissionAclWhatOptions[];
    readonly enabledLink: boolean;
    readonly enabledPassword: boolean;
    readonly password: string;
    readonly passwordVisible: boolean;
    readonly selectedUserIds: string[];
    readonly selectedUserGroupIds: string[];
}

export default class Permission extends PureComponent<PermissionProps, PermissionState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: PermissionProps) {
        super(props);
        const maybePw = props.permission?.acl?.who.password;
        this.state = {
            selectedWhat: props.permission?.acl?.what_file ?? [],
            enabledLink: props.permission?.acl?.who.link ?? false,
            enabledPassword: typeof maybePw === "string" && maybePw.length > 0,
            password: props.permission?.acl?.who.password ?? "",
            passwordVisible: false,
            selectedUserIds: props.permission?.acl?.who.users?.user_ids ?? [],
            selectedUserGroupIds: props.permission?.acl?.who.users?.user_group_ids ?? []
        };
    }

    componentDidMount = async () => {
        if (!this.context) return;
    };

    render = () => {
        const link = `${window.location.origin}?f=${this.props.fileId}`;
        const inputWidths = "80%";
        return (
            <div className="Permission">
                <div style={{ marginBottom: "5px" }}>
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
                                value={this.state.password}
                                onChange={value => {
                                    this.setState({ password: value });
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
                    <label>and the following users/groups</label>
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
                    data={data}
                    onChange={permissions => {
                        permissions = permissions.flatMap(p => {
                            if (p === "Get") {
                                return ["GetFile", "GetFileInfos"];
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
                        });
                        console.log(permissions);
                    }}
                />
                {this.props.readonly !== true && (
                    <Button
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

const data = [
    {
        label: "Read",
        value: "Get",
        children: [
            {
                label: "File",
                value: "GetFile"
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

const defaultFilePermission: FilezPermission = {
    _id: "",
    acl: {
        what_file: [],
        what_group: [],
        who: {
            link: false,
            password: null,
            users: {
                user_group_ids: [],
                user_ids: []
            }
        }
    },
    name: "",
    owner_id: "",
    ribston: "",
    use_type: "Once"
};
