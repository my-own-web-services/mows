import { Badge } from "@my-own-web-services/react-components/components/ui/badge";
import { Button } from "@my-own-web-services/react-components/components/ui/button";
import { Input } from "@my-own-web-services/react-components/components/ui/input";
import { Label } from "@my-own-web-services/react-components/components/ui/label";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@my-own-web-services/react-components/components/ui/tabs";
import { log } from "@my-own-web-services/react-components/lib/logging";
import { MowsContext } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import { type FilezContextType, withFilez } from "@/lib/filezContext/FilezContext";
import {
    FilezUser,
    GroupJoinPolicy,
    GroupVisibility,
    UserGroup,
    UserUserGroupInvitation,
    UserUserGroupJoinRequest
} from "filez-client-typescript";
import {
    DoorOpen,
    Inbox,
    LogOut,
    Send,
    Trash2,
    UserMinus,
    UserPlus,
    Users
} from "lucide-react";
import { PureComponent, type CSSProperties } from "react";
import { mapGroupJoinPolicyLabel, mapGroupVisibilityLabel } from "../labels";

const MEMBER_PAGE_SIZE = 100;

interface UserGroupDetailProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly userGroup: UserGroup;
    readonly onChanged?: (userGroup?: UserGroup) => void;
    readonly onDeleted?: () => void;
    readonly filez: FilezContextType;
}

interface UserGroupDetailState {
    readonly members: FilezUser[];
    readonly invitations: UserUserGroupInvitation[];
    readonly joinRequests: UserUserGroupJoinRequest[];
    readonly loadingMembers: boolean;
    readonly loadingInvitations: boolean;
    readonly loadingRequests: boolean;
    readonly inviteUserId: string;
    readonly inviteMessage: string;
    readonly inviteBusy: boolean;
    readonly deleteBusy: boolean;
    readonly leaveBusy: boolean;
    readonly busyMemberId: string | null;
    readonly busyRequestUserId: string | null;
    readonly error: string | null;
}

class UserGroupDetailBase extends PureComponent<UserGroupDetailProps, UserGroupDetailState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    state: UserGroupDetailState = {
        members: [],
        invitations: [],
        joinRequests: [],
        loadingMembers: false,
        loadingInvitations: false,
        loadingRequests: false,
        inviteUserId: ``,
        inviteMessage: ``,
        inviteBusy: false,
        deleteBusy: false,
        leaveBusy: false,
        busyMemberId: null,
        busyRequestUserId: null,
        error: null
    };

    get isOwner(): boolean {
        return this.props.filez.ownFilezUser?.id === this.props.userGroup.owner_id;
    }

    get isMember(): boolean {
        const myId = this.props.filez.ownFilezUser?.id;
        return Boolean(myId && this.state.members.some((m) => m.id === myId));
    }

    componentDidMount = async () => {
        await this.loadMembers();
        if (this.isOwner) {
            await Promise.all([this.loadInvitations(), this.loadJoinRequests()]);
        }
    };

    componentDidUpdate = async (prevProps: UserGroupDetailProps) => {
        if (prevProps.userGroup.id !== this.props.userGroup.id) {
            this.setState({
                members: [],
                invitations: [],
                joinRequests: [],
                error: null
            });
            await this.loadMembers();
            if (this.isOwner) {
                await Promise.all([this.loadInvitations(), this.loadJoinRequests()]);
            }
        }
    };

    loadMembers = async () => {
        const { t } = this.context!;
        this.setState({ loadingMembers: true, error: null });
        try {
            const response = await this.props.filez.filezClient.api.listUsersByUserGroup({
                user_group_id: this.props.userGroup.id,
                from_index: 0,
                limit: MEMBER_PAGE_SIZE
            });
            this.setState({
                members: response?.data?.data?.users ?? [],
                loadingMembers: false
            });
        } catch (error) {
            log.error(`UserGroupDetail: listUsersByUserGroup failed`, error);
            this.setState({
                loadingMembers: false,
                error: t.userGroupDetail.errors.loadMembers
            });
        }
    };

    loadInvitations = async () => {
        const { t } = this.context!;
        this.setState({ loadingInvitations: true });
        try {
            const response =
                await this.props.filez.filezClient.api.listGroupInvitations(
                    this.props.userGroup.id
                );
            this.setState({
                invitations: response?.data?.data?.invitations ?? [],
                loadingInvitations: false
            });
        } catch (error) {
            log.error(`UserGroupDetail: listGroupInvitations failed`, error);
            this.setState({
                loadingInvitations: false,
                error: t.userGroupDetail.errors.loadInvitations
            });
        }
    };

    loadJoinRequests = async () => {
        const { t } = this.context!;
        this.setState({ loadingRequests: true });
        try {
            const response =
                await this.props.filez.filezClient.api.listGroupJoinRequests(
                    this.props.userGroup.id
                );
            this.setState({
                joinRequests: response?.data?.data?.join_requests ?? [],
                loadingRequests: false
            });
        } catch (error) {
            log.error(`UserGroupDetail: listGroupJoinRequests failed`, error);
            this.setState({
                loadingRequests: false,
                error: t.userGroupDetail.errors.loadJoinRequests
            });
        }
    };

    handleInvite = async () => {
        const { t } = this.context!;
        const { inviteUserId, inviteMessage } = this.state;
        if (!inviteUserId.trim()) return;
        this.setState({ inviteBusy: true, error: null });
        try {
            await this.props.filez.filezClient.api.inviteToUserGroup(
                this.props.userGroup.id,
                {
                    user_id: inviteUserId.trim(),
                    message: inviteMessage.trim() || null
                }
            );
            this.setState({ inviteUserId: ``, inviteMessage: `` });
            await this.loadInvitations();
        } catch (error) {
            log.error(`UserGroupDetail: inviteToUserGroup failed`, error);
            this.setState({ error: t.userGroupDetail.errors.invite });
        } finally {
            this.setState({ inviteBusy: false });
        }
    };

    handleApprove = async (userId: string) => {
        const { t } = this.context!;
        this.setState({ busyRequestUserId: userId, error: null });
        try {
            await this.props.filez.filezClient.api.approveJoinRequest(
                this.props.userGroup.id,
                userId
            );
            await Promise.all([this.loadMembers(), this.loadJoinRequests()]);
        } catch (error) {
            log.error(`UserGroupDetail: approveJoinRequest failed`, error);
            this.setState({ error: t.userGroupDetail.errors.approve });
        } finally {
            this.setState({ busyRequestUserId: null });
        }
    };

    handleReject = async (userId: string) => {
        const { t } = this.context!;
        this.setState({ busyRequestUserId: userId, error: null });
        try {
            await this.props.filez.filezClient.api.rejectJoinRequest(
                this.props.userGroup.id,
                userId
            );
            await this.loadJoinRequests();
        } catch (error) {
            log.error(`UserGroupDetail: rejectJoinRequest failed`, error);
            this.setState({ error: t.userGroupDetail.errors.reject });
        } finally {
            this.setState({ busyRequestUserId: null });
        }
    };

    handleRemoveMember = async (userId: string) => {
        const { t } = this.context!;
        this.setState({ busyMemberId: userId, error: null });
        try {
            await this.props.filez.filezClient.api.updateUserGroupMembers({
                user_group_id: this.props.userGroup.id,
                users_to_remove: [userId],
                users_to_add: null
            });
            await this.loadMembers();
        } catch (error) {
            log.error(`UserGroupDetail: updateUserGroupMembers (remove) failed`, error);
            this.setState({ error: t.userGroupDetail.errors.removeMember });
        } finally {
            this.setState({ busyMemberId: null });
        }
    };

    handleLeave = async () => {
        const { t } = this.context!;
        this.setState({ leaveBusy: true, error: null });
        try {
            await this.props.filez.filezClient.api.leaveUserGroup(
                this.props.userGroup.id
            );
            this.props.onChanged?.();
            await this.loadMembers();
        } catch (error) {
            log.error(`UserGroupDetail: leaveUserGroup failed`, error);
            this.setState({ error: t.userGroupDetail.errors.leave });
        } finally {
            this.setState({ leaveBusy: false });
        }
    };

    handleDelete = async () => {
        const { t } = this.context!;
        this.setState({ deleteBusy: true, error: null });
        try {
            await this.props.filez.filezClient.api.deleteUserGroup(
                this.props.userGroup.id
            );
            this.props.onDeleted?.();
        } catch (error) {
            log.error(`UserGroupDetail: deleteUserGroup failed`, error);
            this.setState({
                error: t.userGroupDetail.errors.deleteGroup,
                deleteBusy: false
            });
        }
    };

    handleRequestJoin = async () => {
        const { t } = this.context!;
        this.setState({ error: null });
        try {
            await this.props.filez.filezClient.api.requestToJoinUserGroup(
                this.props.userGroup.id,
                { message: null }
            );
            this.props.onChanged?.();
        } catch (error) {
            log.error(`UserGroupDetail: requestToJoinUserGroup failed`, error);
            this.setState({ error: t.userGroupDetail.errors.requestJoin });
        }
    };

    renderHeader = () => {
        const { userGroup } = this.props;
        const { t } = this.context!;

        return (
            <div className={`space-y-2`}>
                <div className={`flex items-center gap-2`}>
                    <Users className={`h-5 w-5`} aria-hidden />
                    <h2 className={`text-lg font-semibold`}>{userGroup.name}</h2>
                </div>
                <div className={`flex flex-wrap gap-2`}>
                    <Badge variant={`outline`}>
                        {mapGroupVisibilityLabel(
                            userGroup.visibility,
                            t.userGroupList.visibility
                        )}
                    </Badge>
                    <Badge variant={`secondary`}>
                        {mapGroupJoinPolicyLabel(
                            userGroup.join_policy,
                            t.userGroupList.joinPolicy
                        )}
                    </Badge>
                </div>
                {userGroup.description && (
                    <p className={`text-muted-foreground text-sm`}>
                        {userGroup.description}
                    </p>
                )}
                <p className={`text-muted-foreground text-xs`}>{userGroup.id}</p>
            </div>
        );
    };

    renderViewerActions = () => {
        const { userGroup } = this.props;
        const { t } = this.context!;
        const { leaveBusy, deleteBusy } = this.state;

        const isOwner = this.isOwner;
        const isMember = this.isMember;

        return (
            <div className={`flex flex-wrap gap-2`}>
                {!isOwner && !isMember && userGroup.join_policy !== GroupJoinPolicy.InviteOnly && (
                    <Button size={`sm`} onClick={this.handleRequestJoin}>
                        <DoorOpen className={`mr-2 h-4 w-4`} />
                        {userGroup.join_policy === GroupJoinPolicy.OpenJoin
                            ? t.userGroupDetail.join
                            : t.userGroupDetail.requestJoin}
                    </Button>
                )}
                {!isOwner && isMember && (
                    <Button
                        size={`sm`}
                        variant={`outline`}
                        onClick={this.handleLeave}
                        disabled={leaveBusy}
                    >
                        <LogOut className={`mr-2 h-4 w-4`} />
                        {leaveBusy ? t.userGroupDetail.working : t.userGroupDetail.leave}
                    </Button>
                )}
                {isOwner && (
                    <Button
                        size={`sm`}
                        variant={`destructive`}
                        onClick={this.handleDelete}
                        disabled={deleteBusy}
                    >
                        <Trash2 className={`mr-2 h-4 w-4`} />
                        {deleteBusy
                            ? t.userGroupDetail.working
                            : t.userGroupDetail.deleteGroup}
                    </Button>
                )}
            </div>
        );
    };

    renderMembersTab = () => {
        const { members, loadingMembers, busyMemberId } = this.state;
        const { t } = this.context!;
        const isOwner = this.isOwner;
        const ownerId = this.props.userGroup.owner_id;

        if (loadingMembers) {
            return (
                <p className={`text-muted-foreground py-4 text-sm`}>
                    {t.userGroupDetail.loading}
                </p>
            );
        }
        if (members.length === 0) {
            return (
                <p className={`text-muted-foreground py-4 text-sm`}>
                    {t.userGroupDetail.noMembers}
                </p>
            );
        }
        return (
            <ul className={`space-y-2`}>
                {members.map((member) => {
                    const isMemberOwner = member.id === ownerId;
                    const busy = busyMemberId === member.id;
                    return (
                        <li
                            key={member.id}
                            className={`flex items-center justify-between gap-2 rounded-md border border-border bg-card p-3`}
                        >
                            <div className={`flex flex-col`}>
                                <span className={`font-medium`}>
                                    {member.display_name || member.id}
                                </span>
                                <span className={`text-muted-foreground text-xs`}>
                                    {member.id}
                                </span>
                            </div>
                            <div className={`flex items-center gap-2`}>
                                {isMemberOwner && (
                                    <Badge variant={`outline`}>
                                        {t.userGroupDetail.ownerBadge}
                                    </Badge>
                                )}
                                {isOwner && !isMemberOwner && (
                                    <Button
                                        size={`sm`}
                                        variant={`outline`}
                                        disabled={busy}
                                        onClick={() => this.handleRemoveMember(member.id)}
                                    >
                                        <UserMinus className={`mr-2 h-4 w-4`} />
                                        {busy
                                            ? t.userGroupDetail.working
                                            : t.userGroupDetail.removeMember}
                                    </Button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    };

    renderInviteForm = () => {
        const { inviteUserId, inviteMessage, inviteBusy } = this.state;
        const { t } = this.context!;
        return (
            <div className={`space-y-2 rounded-md border border-border bg-card p-3`}>
                <div className={`flex flex-col gap-1`}>
                    <Label
                        htmlFor={`invite-user-id`}
                        className={`text-sm font-medium`}
                    >
                        {t.userGroupDetail.inviteUserIdLabel}
                    </Label>
                    <Input
                        id={`invite-user-id`}
                        value={inviteUserId}
                        onChange={(e) =>
                            this.setState({ inviteUserId: e.target.value })
                        }
                        placeholder={t.userGroupDetail.inviteUserIdPlaceholder}
                        disabled={inviteBusy}
                    />
                </div>
                <div className={`flex flex-col gap-1`}>
                    <Label
                        htmlFor={`invite-message`}
                        className={`text-sm font-medium`}
                    >
                        {t.userGroupDetail.inviteMessageLabel}
                    </Label>
                    <Input
                        id={`invite-message`}
                        value={inviteMessage}
                        onChange={(e) =>
                            this.setState({ inviteMessage: e.target.value })
                        }
                        maxLength={1024}
                        disabled={inviteBusy}
                    />
                </div>
                <div className={`flex justify-end`}>
                    <Button
                        size={`sm`}
                        disabled={inviteBusy || !inviteUserId.trim()}
                        onClick={this.handleInvite}
                    >
                        <UserPlus className={`mr-2 h-4 w-4`} />
                        {inviteBusy
                            ? t.userGroupDetail.working
                            : t.userGroupDetail.invite}
                    </Button>
                </div>
            </div>
        );
    };

    renderInvitationsTab = () => {
        const { invitations, loadingInvitations } = this.state;
        const { t } = this.context!;

        return (
            <div className={`space-y-3`}>
                {this.renderInviteForm()}
                {loadingInvitations ? (
                    <p className={`text-muted-foreground py-4 text-sm`}>
                        {t.userGroupDetail.loading}
                    </p>
                ) : invitations.length === 0 ? (
                    <p className={`text-muted-foreground py-4 text-sm`}>
                        {t.userGroupDetail.noInvitations}
                    </p>
                ) : (
                    <ul className={`space-y-2`}>
                        {invitations.map((invitation) => (
                            <li
                                key={invitation.user_id}
                                className={`flex items-start gap-3 rounded-md border border-border bg-card p-3`}
                            >
                                <Inbox
                                    className={`mt-0.5 h-4 w-4 text-muted-foreground`}
                                    aria-hidden
                                />
                                <div className={`flex flex-1 flex-col gap-1`}>
                                    <span className={`font-medium`}>
                                        {t.userGroupDetail.userIdPrefix}{` `}
                                        <span className={`font-mono text-sm`}>
                                            {invitation.user_id}
                                        </span>
                                    </span>
                                    {invitation.message && (
                                        <p className={`text-muted-foreground text-sm`}>
                                            {invitation.message}
                                        </p>
                                    )}
                                    <span className={`text-muted-foreground text-xs`}>
                                        {t.userGroupDetail.invitedOn(
                                            new Date(
                                                invitation.invited_time
                                            ).toLocaleString()
                                        )}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    };

    renderJoinRequestsTab = () => {
        const { joinRequests, loadingRequests, busyRequestUserId } = this.state;
        const { t } = this.context!;

        if (loadingRequests) {
            return (
                <p className={`text-muted-foreground py-4 text-sm`}>
                    {t.userGroupDetail.loading}
                </p>
            );
        }
        if (joinRequests.length === 0) {
            return (
                <p className={`text-muted-foreground py-4 text-sm`}>
                    {t.userGroupDetail.noJoinRequests}
                </p>
            );
        }

        return (
            <ul className={`space-y-2`}>
                {joinRequests.map((request) => {
                    const busy = busyRequestUserId === request.user_id;
                    return (
                        <li
                            key={request.user_id}
                            className={`flex items-start gap-3 rounded-md border border-border bg-card p-3`}
                        >
                            <Send
                                className={`mt-0.5 h-4 w-4 text-muted-foreground`}
                                aria-hidden
                            />
                            <div className={`flex flex-1 flex-col gap-1`}>
                                <span className={`font-medium`}>
                                    {t.userGroupDetail.userIdPrefix}{` `}
                                    <span className={`font-mono text-sm`}>
                                        {request.user_id}
                                    </span>
                                </span>
                                {request.message && (
                                    <p className={`text-muted-foreground text-sm`}>
                                        {request.message}
                                    </p>
                                )}
                                <span className={`text-muted-foreground text-xs`}>
                                    {t.userGroupDetail.requestedOn(
                                        new Date(request.requested_time).toLocaleString()
                                    )}
                                </span>
                            </div>
                            <div className={`flex gap-2`}>
                                <Button
                                    size={`sm`}
                                    variant={`outline`}
                                    disabled={busy}
                                    onClick={() => this.handleReject(request.user_id)}
                                >
                                    {t.userGroupDetail.reject}
                                </Button>
                                <Button
                                    size={`sm`}
                                    disabled={busy}
                                    onClick={() => this.handleApprove(request.user_id)}
                                >
                                    {busy
                                        ? t.userGroupDetail.working
                                        : t.userGroupDetail.approve}
                                </Button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    };

    render = () => {
        const { className, style } = this.props;
        const { error } = this.state;
        const { t } = this.context!;
        const isOwner = this.isOwner;

        return (
            <div className={className} style={style}>
                <div className={`space-y-4`}>
                    {this.renderHeader()}
                    {this.renderViewerActions()}
                    {error && <p className={`text-destructive text-sm`}>{error}</p>}
                    <Tabs defaultValue={`members`}>
                        <TabsList>
                            <TabsTrigger value={`members`}>
                                {t.userGroupDetail.tabs.members}
                            </TabsTrigger>
                            {isOwner && (
                                <TabsTrigger value={`invitations`}>
                                    {t.userGroupDetail.tabs.invitations}
                                </TabsTrigger>
                            )}
                            {isOwner && (
                                <TabsTrigger value={`requests`}>
                                    {t.userGroupDetail.tabs.requests}
                                </TabsTrigger>
                            )}
                        </TabsList>
                        <TabsContent value={`members`}>
                            {this.renderMembersTab()}
                        </TabsContent>
                        {isOwner && (
                            <TabsContent value={`invitations`}>
                                {this.renderInvitationsTab()}
                            </TabsContent>
                        )}
                        {isOwner && (
                            <TabsContent value={`requests`}>
                                {this.renderJoinRequestsTab()}
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
            </div>
        );
    };
}

export default withFilez(UserGroupDetailBase);
