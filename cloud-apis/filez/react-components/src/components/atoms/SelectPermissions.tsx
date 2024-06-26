import { PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";
import { Button, Modal, TagPicker } from "rsuite";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import Permission from "../resources/Permission";
import update from "immutability-helper";
import { match } from "ts-pattern";

interface SelectPermissionsProps {
    readonly size?: "lg" | "md" | "sm" | "xs";
    readonly type: "File" | "User" | "UserGroup" | "FileGroup";
    readonly onUpdate?: (permissionIds: string[]) => void;
    readonly selectedPermissionIds?: string[];
}

interface SelectPermissionsState {
    readonly existingPermissions: FilezPermission[];
    readonly newPermissionModalOpen: boolean;
    readonly selectedPermissionIds: string[];
}

export default class SelectPermissions extends PureComponent<
    SelectPermissionsProps,
    SelectPermissionsState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: SelectPermissionsProps) {
        super(props);
        this.state = {
            existingPermissions: [],
            newPermissionModalOpen: false,
            selectedPermissionIds: props.selectedPermissionIds ?? []
        };
    }

    componentDidMount = async () => {
        await this.loadPermissions();
    };

    loadPermissions = async () => {
        if (!this.context) return;
        const { items } = await this.context.filezClient.list_permissions({
            sort_field: "name"
        });

        const existingPermissions = items.filter((item) => {
            return (
                item.use_type === "Multiple" &&
                item.content.type === this.props.type
            );
        });

        this.setState({ existingPermissions });
    };

    newPermissionCreated = async (newPermissionId: string) => {
        await this.loadPermissions();

        this.setState(
            (state) => {
                return update(state, {
                    selectedPermissionIds: {
                        $push: [newPermissionId]
                    },
                    newPermissionModalOpen: {
                        $set: false
                    }
                });
            },
            () => {
                this.props.onUpdate?.(this.state.selectedPermissionIds);
            }
        );
    };

    render = () => {
        if (!this.context) return null;
        return (
            <div className="SelectPermissions">
                <TagPicker
                    size={this.props.size}
                    data={this.state.existingPermissions.map((p) => {
                        return {
                            label: p.name ?? p._id,
                            value: p._id
                        };
                    })}
                    value={this.state.selectedPermissionIds}
                    onChange={(value) => {
                        this.setState({ selectedPermissionIds: value ?? [] });
                        this.props.onUpdate?.(value ?? []);
                    }}
                />
                <Button
                    size={this.props.size}
                    onClick={() => {
                        this.setState({ newPermissionModalOpen: true });
                    }}
                    appearance="default"
                >
                    New
                </Button>
                <Modal
                    open={this.state.newPermissionModalOpen}
                    onClose={() => {
                        this.setState({ newPermissionModalOpen: false });
                    }}
                >
                    <Modal.Header>
                        <Modal.Title>
                            New{" "}
                            {match(this.props.type)
                                .with("File", () => "File")
                                .with("User", () => "User")
                                .with("UserGroup", () => "User Group")
                                .with("FileGroup", () => "File Group")
                                .exhaustive()}{" "}
                            Permission
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Permission
                            size={this.props.size}
                            onSave={this.newPermissionCreated}
                            permissionType={this.props.type}
                            disableTypeChange={true}
                            hideTypeChanger={true}
                        />
                    </Modal.Body>
                </Modal>
            </div>
        );
    };
}
