import { Button } from "@my-own-web-services/react-components/components/ui/button";
import { Input } from "@my-own-web-services/react-components/components/ui/input";
import { Label } from "@my-own-web-services/react-components/components/ui/label";
import { log } from "@my-own-web-services/react-components/lib/logging";
import { MowsContext } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import { type FilezContextType, withFilez } from "@/lib/filezContext/FilezContext";
import { UserGroup } from "filez-client-typescript";
import { PureComponent, type CSSProperties } from "react";

interface UserGroupCreateProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly onUserGroupCreated?: (userGroup: UserGroup) => void;
    readonly onCancel?: () => void;
    readonly filez: FilezContextType;
}

interface UserGroupCreateState {
    readonly name: string;
    readonly isCreating: boolean;
    readonly error: string | null;
}

class UserGroupCreateBase extends PureComponent<
    UserGroupCreateProps,
    UserGroupCreateState
> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    constructor(props: UserGroupCreateProps) {
        super(props);
        this.state = {
            name: ``,
            isCreating: false,
            error: null
        };
    }

    handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ name: e.target.value, error: null });
    };

    handleCreate = async () => {
        const { name } = this.state;
        const { t } = this.context!;

        if (!name.trim()) {
            this.setState({ error: t.userGroupCreate.nameRequired });
            return;
        }

        if (name.length > 256) {
            this.setState({ error: t.userGroupCreate.nameTooLong });
            return;
        }

        this.setState({ isCreating: true, error: null });

        try {
            const response = await this.props.filez.filezClient.api.createUserGroup({
                user_group_name: name.trim()
            });

            const createdUserGroup = response?.data?.data?.created_user_group;

            if (createdUserGroup) {
                this.props.onUserGroupCreated?.(createdUserGroup);
                this.setState({ name: ``, isCreating: false });
            } else {
                this.setState({
                    error: t.userGroupCreate.createFailed,
                    isCreating: false
                });
            }
        } catch (error) {
            log.error(`UserGroupCreate: createUserGroup failed`, error);
            this.setState({
                error: t.userGroupCreate.createFailed,
                isCreating: false
            });
        }
    };

    handleCancel = () => {
        this.setState({ name: ``, error: null });
        this.props.onCancel?.();
    };

    handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === `Enter` && !this.state.isCreating) {
            e.preventDefault();
            this.handleCreate();
        }
    };

    render = () => {
        const { className, style } = this.props;
        const { name, isCreating, error } = this.state;
        const { t } = this.context!;

        return (
            <div className={className} style={style}>
                <div className={`space-y-4 py-4`}>
                    <div className={`space-y-2`}>
                        <Label htmlFor={`name`} className={`text-sm font-medium`}>
                            {t.userGroupCreate.nameLabel}
                        </Label>
                        <Input
                            id={`name`}
                            value={name}
                            onChange={this.handleNameChange}
                            onKeyDown={this.handleKeyDown}
                            placeholder={t.userGroupCreate.namePlaceholder}
                            disabled={isCreating}
                            autoFocus
                            maxLength={256}
                        />
                        {error && <p className={`text-sm text-red-600`}>{error}</p>}
                    </div>
                </div>
                <div className={`flex justify-end gap-2`}>
                    <Button variant={`outline`} onClick={this.handleCancel} disabled={isCreating}>
                        {t.userGroupCreate.cancel}
                    </Button>
                    <Button onClick={this.handleCreate} disabled={isCreating || !name.trim()}>
                        {isCreating ? t.userGroupCreate.creating : t.userGroupCreate.create}
                    </Button>
                </div>
            </div>
        );
    };
}

export default withFilez(UserGroupCreateBase);
