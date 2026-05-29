import { Button } from "@my-own-web-services/react-components/components/ui/button";
import { Input } from "@my-own-web-services/react-components/components/ui/input";
import { Label } from "@my-own-web-services/react-components/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@my-own-web-services/react-components/components/ui/select";
import { Textarea } from "@my-own-web-services/react-components/components/ui/textarea";
import { log } from "@my-own-web-services/react-components/lib/logging";
import { MowsContext } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import { type FilezContextType, withFilez } from "@/lib/filezContext/FilezContext";
import {
    GroupJoinPolicy,
    GroupVisibility,
    UpdateUserGroupChangeset,
    UserGroup
} from "filez-client-typescript";
import { PureComponent, type CSSProperties } from "react";

const NAME_MAX_LENGTH = 256;
const DESCRIPTION_MAX_LENGTH = 1024;

interface UserGroupSettingsProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly userGroup: UserGroup;
    readonly onUserGroupUpdated?: (userGroup: UserGroup, autoPromotedRequests: number) => void;
    readonly onCancel?: () => void;
    readonly filez: FilezContextType;
}

interface UserGroupSettingsState {
    readonly name: string;
    readonly description: string;
    readonly visibility: GroupVisibility;
    readonly joinPolicy: GroupJoinPolicy;
    readonly isSaving: boolean;
    readonly error: string | null;
}

const stateFromUserGroup = (userGroup: UserGroup) => ({
    name: userGroup.name,
    description: userGroup.description ?? ``,
    visibility: userGroup.visibility,
    joinPolicy: userGroup.join_policy
});

class UserGroupSettingsBase extends PureComponent<
    UserGroupSettingsProps,
    UserGroupSettingsState
> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    constructor(props: UserGroupSettingsProps) {
        super(props);
        this.state = {
            ...stateFromUserGroup(props.userGroup),
            isSaving: false,
            error: null
        };
    }

    componentDidUpdate = (prevProps: UserGroupSettingsProps) => {
        if (prevProps.userGroup !== this.props.userGroup) {
            this.setState({
                ...stateFromUserGroup(this.props.userGroup),
                isSaving: false,
                error: null
            });
        }
    };

    handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ name: e.target.value, error: null });
    };

    handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        this.setState({ description: e.target.value, error: null });
    };

    handleVisibilityChange = (value: string) => {
        // Guard the cast: only set state if `value` is a real
        // `GroupVisibility` member. Defends against a future swap of
        // `<Select>` for a freeform input that could otherwise drop
        // garbage into the changeset payload.
        if (!Object.values(GroupVisibility).includes(value as GroupVisibility)) {
            return;
        }
        this.setState({ visibility: value as GroupVisibility, error: null });
    };

    handleJoinPolicyChange = (value: string) => {
        if (!Object.values(GroupJoinPolicy).includes(value as GroupJoinPolicy)) {
            return;
        }
        this.setState({ joinPolicy: value as GroupJoinPolicy, error: null });
    };

    buildChangeset = (): UpdateUserGroupChangeset | null => {
        const { userGroup } = this.props;
        const { name, description, visibility, joinPolicy } = this.state;
        const changeset: UpdateUserGroupChangeset = {};
        const trimmedName = name.trim();
        const normalisedDescription = description.trim();

        if (trimmedName !== userGroup.name) {
            changeset.new_user_group_name = trimmedName;
        }
        // Serde double-Option: `null` clears the field, `undefined`
        // (omitted) leaves it alone. We have nothing to clear vs leave
        // distinction here so empty-string maps to "clear".
        const currentDescription = userGroup.description ?? ``;
        if (normalisedDescription !== currentDescription) {
            changeset.new_description =
                normalisedDescription.length === 0 ? null : normalisedDescription;
        }
        if (visibility !== userGroup.visibility) {
            changeset.new_visibility = visibility;
        }
        if (joinPolicy !== userGroup.join_policy) {
            changeset.new_join_policy = joinPolicy;
        }

        return Object.keys(changeset).length === 0 ? null : changeset;
    };

    handleSave = async () => {
        const { t } = this.context!;
        const { name, description } = this.state;

        if (!name.trim()) {
            this.setState({ error: t.userGroupSettings.nameRequired });
            return;
        }
        if (name.length > NAME_MAX_LENGTH) {
            this.setState({ error: t.userGroupSettings.nameTooLong });
            return;
        }
        if (description.length > DESCRIPTION_MAX_LENGTH) {
            this.setState({ error: t.userGroupSettings.descriptionTooLong });
            return;
        }

        const changeset = this.buildChangeset();
        if (!changeset) {
            this.props.onCancel?.();
            return;
        }

        this.setState({ isSaving: true, error: null });

        try {
            const response = await this.props.filez.filezClient.api.updateUserGroup({
                user_group_id: this.props.userGroup.id,
                changeset
            });

            const outcome = response?.data?.data?.outcome;
            if (outcome?.updated_user_group) {
                this.props.onUserGroupUpdated?.(
                    outcome.updated_user_group,
                    outcome.auto_promoted_requests
                );
                this.setState({ isSaving: false });
            } else {
                this.setState({
                    error: t.userGroupSettings.updateFailed,
                    isSaving: false
                });
            }
        } catch (error) {
            log.error(`UserGroupSettings: updateUserGroup failed`, error);
            this.setState({
                error: t.userGroupSettings.updateFailed,
                isSaving: false
            });
        }
    };

    render = () => {
        const { className, style } = this.props;
        const { name, description, visibility, joinPolicy, isSaving, error } = this.state;
        const { t } = this.context!;

        return (
            <div className={className} style={style}>
                <div className={`space-y-4 py-4`}>
                    <div className={`space-y-2`}>
                        <Label htmlFor={`user-group-name`} className={`text-sm font-medium`}>
                            {t.userGroupSettings.nameLabel}
                        </Label>
                        <Input
                            id={`user-group-name`}
                            value={name}
                            onChange={this.handleNameChange}
                            disabled={isSaving}
                            maxLength={NAME_MAX_LENGTH}
                        />
                    </div>
                    <div className={`space-y-2`}>
                        <Label
                            htmlFor={`user-group-description`}
                            className={`text-sm font-medium`}
                        >
                            {t.userGroupSettings.descriptionLabel}
                        </Label>
                        <Textarea
                            id={`user-group-description`}
                            value={description}
                            onChange={this.handleDescriptionChange}
                            placeholder={t.userGroupSettings.descriptionPlaceholder}
                            disabled={isSaving}
                            maxLength={DESCRIPTION_MAX_LENGTH}
                            rows={3}
                        />
                    </div>
                    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2`}>
                        <div className={`space-y-2`}>
                            <Label
                                htmlFor={`user-group-visibility`}
                                className={`text-sm font-medium`}
                            >
                                {t.userGroupSettings.visibilityLabel}
                            </Label>
                            <Select
                                value={visibility}
                                onValueChange={this.handleVisibilityChange}
                                disabled={isSaving}
                            >
                                <SelectTrigger id={`user-group-visibility`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={GroupVisibility.Private}>
                                        {t.userGroupSettings.visibility.private}
                                    </SelectItem>
                                    <SelectItem value={GroupVisibility.ListedRestricted}>
                                        {t.userGroupSettings.visibility.listedRestricted}
                                    </SelectItem>
                                    <SelectItem value={GroupVisibility.Public}>
                                        {t.userGroupSettings.visibility.public}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className={`space-y-2`}>
                            <Label
                                htmlFor={`user-group-join-policy`}
                                className={`text-sm font-medium`}
                            >
                                {t.userGroupSettings.joinPolicyLabel}
                            </Label>
                            <Select
                                value={joinPolicy}
                                onValueChange={this.handleJoinPolicyChange}
                                disabled={isSaving}
                            >
                                <SelectTrigger id={`user-group-join-policy`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={GroupJoinPolicy.InviteOnly}>
                                        {t.userGroupSettings.joinPolicy.inviteOnly}
                                    </SelectItem>
                                    <SelectItem value={GroupJoinPolicy.RequestToJoin}>
                                        {t.userGroupSettings.joinPolicy.requestToJoin}
                                    </SelectItem>
                                    <SelectItem value={GroupJoinPolicy.OpenJoin}>
                                        {t.userGroupSettings.joinPolicy.openJoin}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {error && <p className={`text-sm text-destructive`}>{error}</p>}
                </div>
                <div className={`flex justify-end gap-2`}>
                    <Button
                        variant={`outline`}
                        onClick={this.props.onCancel}
                        disabled={isSaving}
                    >
                        {t.userGroupSettings.cancel}
                    </Button>
                    <Button onClick={this.handleSave} disabled={isSaving || !name.trim()}>
                        {isSaving ? t.userGroupSettings.saving : t.userGroupSettings.save}
                    </Button>
                </div>
            </div>
        );
    };
}

export default withFilez(UserGroupSettingsBase);
