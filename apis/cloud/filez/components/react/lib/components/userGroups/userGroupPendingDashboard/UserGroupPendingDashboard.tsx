import { Badge } from "@my-own-web-services/react-components/components/ui/badge";
import { Button } from "@my-own-web-services/react-components/components/ui/button";
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
    UserUserGroupInvitation,
    UserUserGroupJoinRequest
} from "filez-client-typescript";
import { Inbox, Send } from "lucide-react";
import { PureComponent, type CSSProperties } from "react";

interface UserGroupPendingDashboardProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly onChanged?: () => void;
    readonly filez: FilezContextType;
}

interface UserGroupPendingDashboardState {
    readonly invitations: UserUserGroupInvitation[];
    readonly joinRequests: UserUserGroupJoinRequest[];
    readonly loading: boolean;
    readonly error: string | null;
    readonly busyUserGroupId: string | null;
}

class UserGroupPendingDashboardBase extends PureComponent<
    UserGroupPendingDashboardProps,
    UserGroupPendingDashboardState
> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    state: UserGroupPendingDashboardState = {
        invitations: [],
        joinRequests: [],
        loading: false,
        error: null,
        busyUserGroupId: null
    };

    componentDidMount = async () => {
        await this.loadAll();
    };

    loadAll = async () => {
        const { t } = this.context!;
        this.setState({ loading: true, error: null });
        try {
            const [invResponse, reqResponse] = await Promise.all([
                this.props.filez.filezClient.api.listMyInvitations(),
                this.props.filez.filezClient.api.listMyJoinRequests()
            ]);
            this.setState({
                invitations: invResponse?.data?.data?.invitations ?? [],
                joinRequests: reqResponse?.data?.data?.join_requests ?? [],
                loading: false,
                error: null
            });
        } catch (error) {
            log.error(`UserGroupPendingDashboard: load failed`, error);
            this.setState({
                loading: false,
                error: t.userGroupPendingDashboard.errors.load
            });
        }
    };

    handleAccept = async (userGroupId: string) => {
        const { t } = this.context!;
        this.setState({ busyUserGroupId: userGroupId, error: null });
        try {
            await this.props.filez.filezClient.api.acceptInvitation(userGroupId);
            this.props.onChanged?.();
            await this.loadAll();
        } catch (error) {
            log.error(`UserGroupPendingDashboard: acceptInvitation failed`, error);
            this.setState({ error: t.userGroupPendingDashboard.errors.accept });
        } finally {
            this.setState({ busyUserGroupId: null });
        }
    };

    handleDecline = async (userGroupId: string) => {
        const { t } = this.context!;
        this.setState({ busyUserGroupId: userGroupId, error: null });
        try {
            await this.props.filez.filezClient.api.declineInvitation(userGroupId);
            this.props.onChanged?.();
            await this.loadAll();
        } catch (error) {
            log.error(`UserGroupPendingDashboard: declineInvitation failed`, error);
            this.setState({ error: t.userGroupPendingDashboard.errors.decline });
        } finally {
            this.setState({ busyUserGroupId: null });
        }
    };

    renderInvitation = (invitation: UserUserGroupInvitation) => {
        const { t } = this.context!;
        const { busyUserGroupId } = this.state;
        const busy = busyUserGroupId === invitation.user_group_id;
        return (
            <li
                key={invitation.user_group_id}
                className={`flex items-start gap-3 rounded-md border border-border bg-card p-3`}
            >
                <Inbox className={`mt-0.5 h-4 w-4 text-muted-foreground`} aria-hidden />
                <div className={`flex flex-1 flex-col gap-1`}>
                    <span className={`font-medium`}>
                        {t.userGroupPendingDashboard.groupIdPrefix}{` `}
                        <span className={`font-mono text-sm`}>
                            {invitation.user_group_id}
                        </span>
                    </span>
                    {invitation.message && (
                        <p className={`text-muted-foreground text-sm`}>
                            {invitation.message}
                        </p>
                    )}
                    <span className={`text-muted-foreground text-xs`}>
                        {t.userGroupPendingDashboard.invitedOn(
                            new Date(invitation.invited_time).toLocaleString()
                        )}
                    </span>
                </div>
                <div className={`flex gap-2`}>
                    <Button
                        size={`sm`}
                        variant={`outline`}
                        disabled={busy}
                        onClick={() => this.handleDecline(invitation.user_group_id)}
                    >
                        {t.userGroupPendingDashboard.decline}
                    </Button>
                    <Button
                        size={`sm`}
                        disabled={busy}
                        onClick={() => this.handleAccept(invitation.user_group_id)}
                    >
                        {busy
                            ? t.userGroupPendingDashboard.working
                            : t.userGroupPendingDashboard.accept}
                    </Button>
                </div>
            </li>
        );
    };

    renderJoinRequest = (request: UserUserGroupJoinRequest) => {
        const { t } = this.context!;
        return (
            <li
                key={request.user_group_id}
                className={`flex items-start gap-3 rounded-md border border-border bg-card p-3`}
            >
                <Send className={`mt-0.5 h-4 w-4 text-muted-foreground`} aria-hidden />
                <div className={`flex flex-1 flex-col gap-1`}>
                    <span className={`font-medium`}>
                        {t.userGroupPendingDashboard.groupIdPrefix}{` `}
                        <span className={`font-mono text-sm`}>
                            {request.user_group_id}
                        </span>
                    </span>
                    {request.message && (
                        <p className={`text-muted-foreground text-sm`}>
                            {request.message}
                        </p>
                    )}
                    <span className={`text-muted-foreground text-xs`}>
                        {t.userGroupPendingDashboard.requestedOn(
                            new Date(request.requested_time).toLocaleString()
                        )}
                    </span>
                </div>
            </li>
        );
    };

    render = () => {
        const { className, style } = this.props;
        const { invitations, joinRequests, loading, error } = this.state;
        const { t } = this.context!;

        return (
            <div className={className} style={style}>
                {error && <p className={`text-destructive pb-2 text-sm`}>{error}</p>}
                <Tabs defaultValue={`invitations`}>
                    <TabsList>
                        <TabsTrigger value={`invitations`}>
                            {t.userGroupPendingDashboard.invitations}
                            <Badge variant={`secondary`} className={`ml-2`}>
                                {invitations.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value={`requests`}>
                            {t.userGroupPendingDashboard.requests}
                            <Badge variant={`secondary`} className={`ml-2`}>
                                {joinRequests.length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value={`invitations`}>
                        {loading ? (
                            <p className={`text-muted-foreground py-4 text-sm`}>
                                {t.userGroupPendingDashboard.loading}
                            </p>
                        ) : invitations.length === 0 ? (
                            <p className={`text-muted-foreground py-4 text-sm`}>
                                {t.userGroupPendingDashboard.noInvitations}
                            </p>
                        ) : (
                            <ul className={`space-y-2`}>
                                {invitations.map(this.renderInvitation)}
                            </ul>
                        )}
                    </TabsContent>
                    <TabsContent value={`requests`}>
                        {loading ? (
                            <p className={`text-muted-foreground py-4 text-sm`}>
                                {t.userGroupPendingDashboard.loading}
                            </p>
                        ) : joinRequests.length === 0 ? (
                            <p className={`text-muted-foreground py-4 text-sm`}>
                                {t.userGroupPendingDashboard.noRequests}
                            </p>
                        ) : (
                            <ul className={`space-y-2`}>
                                {joinRequests.map(this.renderJoinRequest)}
                            </ul>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        );
    };
}

export default withFilez(UserGroupPendingDashboardBase);
