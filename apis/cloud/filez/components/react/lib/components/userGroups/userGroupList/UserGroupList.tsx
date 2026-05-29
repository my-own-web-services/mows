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
    GroupJoinPolicy,
    GroupVisibility,
    ListUserGroupsFilter,
    ListUserGroupsSortBy,
    SortDirection,
    UserGroup
} from "filez-client-typescript";
import { Users } from "lucide-react";
import { PureComponent, type CSSProperties } from "react";
import { mapGroupJoinPolicyLabel, mapGroupVisibilityLabel } from "../labels";

export const USER_GROUP_LIST_FILTERS: readonly ListUserGroupsFilter[] = [
    ListUserGroupsFilter.Owned,
    ListUserGroupsFilter.Member,
    ListUserGroupsFilter.Invited,
    ListUserGroupsFilter.Requested,
    ListUserGroupsFilter.ServerListed,
    ListUserGroupsFilter.Public
] as const;

export const USER_GROUP_LIST_DEFAULT_FILTER: ListUserGroupsFilter = ListUserGroupsFilter.Owned;
export const USER_GROUP_LIST_PAGE_SIZE = 25;

type FilterTabLabels = {
    owned: string;
    member: string;
    invited: string;
    requested: string;
    serverListed: string;
    public: string;
};

const filterTabLabel = (
    value: ListUserGroupsFilter,
    labels: FilterTabLabels
): string => {
    switch (value) {
        case ListUserGroupsFilter.Owned:
            return labels.owned;
        case ListUserGroupsFilter.Member:
            return labels.member;
        case ListUserGroupsFilter.Invited:
            return labels.invited;
        case ListUserGroupsFilter.Requested:
            return labels.requested;
        case ListUserGroupsFilter.ServerListed:
            return labels.serverListed;
        case ListUserGroupsFilter.Public:
            return labels.public;
        case ListUserGroupsFilter.AccessGranted:
            // Not in USER_GROUP_LIST_FILTERS; AccessGranted is the picker
            // default and isn't surfaced as a directory tab.
            return labels.owned;
    }
};

interface UserGroupListProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly filter?: ListUserGroupsFilter;
    readonly onFilterChange?: (filter: ListUserGroupsFilter) => void;
    readonly onSelect?: (userGroup: UserGroup) => void;
    readonly filez: FilezContextType;
}

interface UserGroupListState {
    readonly filter: ListUserGroupsFilter;
    readonly userGroups: UserGroup[];
    readonly totalCount: number;
    readonly loading: boolean;
    readonly error: string | null;
}

class UserGroupListBase extends PureComponent<UserGroupListProps, UserGroupListState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    constructor(props: UserGroupListProps) {
        super(props);
        this.state = {
            filter: props.filter ?? USER_GROUP_LIST_DEFAULT_FILTER,
            userGroups: [],
            totalCount: 0,
            loading: false,
            error: null
        };
    }

    componentDidMount = async () => {
        await this.loadGroups(this.state.filter);
    };

    componentDidUpdate = async (prevProps: UserGroupListProps) => {
        if (prevProps.filter !== this.props.filter && this.props.filter) {
            this.setState({ filter: this.props.filter });
            await this.loadGroups(this.props.filter);
        }
    };

    loadGroups = async (filter: ListUserGroupsFilter) => {
        const { t } = this.context!;
        this.setState({ loading: true, error: null });
        try {
            const response = await this.props.filez.filezClient.api.listUserGroups({
                filter,
                from_index: 0,
                limit: USER_GROUP_LIST_PAGE_SIZE,
                sort_by: ListUserGroupsSortBy.Name,
                sort_order: SortDirection.Ascending
            });
            const body = response?.data?.data;
            this.setState({
                userGroups: body?.user_groups ?? [],
                totalCount: body?.total_count ?? 0,
                loading: false,
                error: null
            });
        } catch (error) {
            log.error(`UserGroupList: listUserGroups failed`, error);
            this.setState({
                userGroups: [],
                totalCount: 0,
                loading: false,
                error: t.userGroupList.loadFailed
            });
        }
    };

    handleTabChange = (value: string) => {
        const next = value as ListUserGroupsFilter;
        this.setState({ filter: next });
        this.props.onFilterChange?.(next);
        this.loadGroups(next);
    };

    renderVisibilityBadge = (visibility: GroupVisibility) => {
        const { t } = this.context!;
        return (
            <Badge variant={`outline`} className={`text-xs`}>
                {mapGroupVisibilityLabel(visibility, t.userGroupList.visibility)}
            </Badge>
        );
    };

    renderJoinPolicyBadge = (joinPolicy: GroupJoinPolicy) => {
        const { t } = this.context!;
        return (
            <Badge variant={`secondary`} className={`text-xs`}>
                {mapGroupJoinPolicyLabel(joinPolicy, t.userGroupList.joinPolicy)}
            </Badge>
        );
    };

    renderGroupRow = (group: UserGroup) => {
        const { t } = this.context!;
        return (
            <li
                key={group.id}
                className={`flex items-start gap-3 rounded-md border border-border bg-card p-3`}
            >
                <Users className={`mt-0.5 h-5 w-5 text-muted-foreground`} aria-hidden />
                <div className={`flex flex-1 flex-col gap-1`}>
                    <div className={`flex flex-wrap items-center gap-2`}>
                        <span className={`font-medium`}>{group.name}</span>
                        {this.renderVisibilityBadge(group.visibility)}
                        {this.renderJoinPolicyBadge(group.join_policy)}
                    </div>
                    {group.description && (
                        <p className={`text-muted-foreground text-sm`}>{group.description}</p>
                    )}
                    <span className={`text-muted-foreground text-xs`}>{group.id}</span>
                </div>
                {this.props.onSelect && (
                    <Button
                        size={`sm`}
                        variant={`outline`}
                        onClick={() => this.props.onSelect?.(group)}
                    >
                        {t.userGroupList.open}
                    </Button>
                )}
            </li>
        );
    };

    renderTabContent = () => {
        const { userGroups, loading, error, totalCount } = this.state;
        const { t } = this.context!;

        if (loading) {
            return (
                <p className={`text-muted-foreground py-4 text-sm`}>
                    {t.userGroupList.loading}
                </p>
            );
        }
        if (error) {
            return <p className={`text-destructive py-4 text-sm`}>{error}</p>;
        }
        if (userGroups.length === 0) {
            return (
                <p className={`text-muted-foreground py-4 text-sm`}>
                    {t.userGroupList.empty}
                </p>
            );
        }
        return (
            <div className={`space-y-3`}>
                <p className={`text-muted-foreground text-xs`}>
                    {t.userGroupList.totalCount(totalCount)}
                </p>
                <ul className={`space-y-2`}>{userGroups.map(this.renderGroupRow)}</ul>
            </div>
        );
    };

    render = () => {
        const { className, style } = this.props;
        const { filter } = this.state;
        const { t } = this.context!;

        return (
            <div className={className} style={style}>
                <Tabs value={filter} onValueChange={this.handleTabChange}>
                    <TabsList className={`flex-wrap`}>
                        {USER_GROUP_LIST_FILTERS.map((value) => (
                            <TabsTrigger key={value} value={value}>
                                {filterTabLabel(value, t.userGroupList.filters)}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {USER_GROUP_LIST_FILTERS.map((value) => (
                        <TabsContent key={value} value={value}>
                            {filter === value && this.renderTabContent()}
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        );
    };
}

export default withFilez(UserGroupListBase);
