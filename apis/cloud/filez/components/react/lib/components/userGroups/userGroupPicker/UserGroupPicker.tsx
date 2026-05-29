import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@my-own-web-services/react-components/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@my-own-web-services/react-components/components/ui/popover";
import { log } from "@my-own-web-services/react-components/lib/logging";
import { MowsContext } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import { type FilezContextType, withFilez } from "@/lib/filezContext/FilezContext";
import { cn } from "@/lib/utils";
import {
    ListUserGroupsFilter,
    ListUserGroupsSortBy,
    SortDirection,
    UserGroup
} from "filez-client-typescript";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import { PureComponent, type CSSProperties, type ReactNode } from "react";

export const USER_GROUP_PICKER_DEFAULT_FILTER: ListUserGroupsFilter =
    ListUserGroupsFilter.AccessGranted;
export const USER_GROUP_PICKER_PAGE_SIZE = 100;

interface UserGroupPickerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly value?: UserGroup;
    readonly onValueChange?: (value?: UserGroup) => void;
    readonly getUserGroups?: () => Promise<UserGroup[] | undefined>;
    readonly filter?: ListUserGroupsFilter;
    readonly disabled?: boolean;
    readonly placeholder?: string;
    readonly triggerComponent?: ReactNode;
    readonly standalone?: boolean;
    readonly autofocus?: boolean;
    readonly filez: FilezContextType;
}

interface UserGroupPickerState {
    readonly open: boolean;
    readonly userGroups: UserGroup[];
    readonly loading: boolean;
    readonly error: string | null;
}

class UserGroupPickerBase extends PureComponent<UserGroupPickerProps, UserGroupPickerState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    constructor(props: UserGroupPickerProps) {
        super(props);
        this.state = {
            open: false,
            userGroups: [],
            loading: false,
            error: null
        };
    }

    componentDidMount = async () => {
        await this.loadGroups();
    };

    componentDidUpdate = async (prevProps: UserGroupPickerProps) => {
        if (
            this.props.getUserGroups !== prevProps.getUserGroups ||
            this.props.filter !== prevProps.filter
        ) {
            await this.loadGroups();
        }
    };

    loadGroups = async () => {
        const { t } = this.context!;
        this.setState({ loading: true, error: null });
        try {
            let groups: UserGroup[] | undefined;

            if (this.props.getUserGroups) {
                groups = await this.props.getUserGroups();
            } else {
                const res = await this.props.filez.filezClient.api.listUserGroups({
                    filter: this.props.filter ?? USER_GROUP_PICKER_DEFAULT_FILTER,
                    from_index: 0,
                    limit: USER_GROUP_PICKER_PAGE_SIZE,
                    sort_by: ListUserGroupsSortBy.Name,
                    sort_order: SortDirection.Ascending
                });
                groups = res?.data?.data?.user_groups;
            }

            const userGroups = groups || [];

            this.setState({
                userGroups,
                loading: false,
                error: null
            });

            if (userGroups.length === 1 && !this.props.value) {
                this.props.onValueChange?.(userGroups[0]);
            }
        } catch (error) {
            log.error(`UserGroupPicker: listUserGroups failed`, error);
            this.setState({
                userGroups: [],
                loading: false,
                error: t.userGroupPicker.loadFailed
            });
        }
    };

    handleOpenChange = (open: boolean) => {
        this.setState({ open });
        if (open && this.state.userGroups.length === 0) {
            this.loadGroups();
        }
        if (open && this.state.userGroups.length === 1 && !this.props.value) {
            this.props.onValueChange?.(this.state.userGroups[0]);
            this.setState({ open: false });
        }
    };

    handleSelect = (userGroup: UserGroup) => {
        this.setState({ open: false });
        this.props.onValueChange?.(userGroup);
    };

    filterUserGroups = (value: string, search: string) => {
        const userGroup = this.state.userGroups.find((group) => group.id === value);
        if (!userGroup) return 0;
        const searchLower = search.toLowerCase();
        const nameMatch = userGroup.name.toLowerCase().includes(searchLower);
        const idMatch = userGroup.id.toLowerCase().includes(searchLower);
        return nameMatch || idMatch ? 1 : 0;
    };

    renderContent = () => {
        const { value, placeholder, autofocus = false } = this.props;
        const { userGroups, loading, error } = this.state;
        const { t } = this.context!;

        const displayPlaceholder = placeholder || t.userGroupPicker.selectUserGroup;

        if (loading) {
            return (
                <div className={`py-6 text-center text-sm`}>
                    {t.userGroupPicker.loading}
                </div>
            );
        }
        if (error) {
            return (
                <div className={`text-destructive py-6 text-center text-sm`}>{error}</div>
            );
        }

        return (
            <Command filter={this.filterUserGroups}>
                <CommandInput placeholder={displayPlaceholder} autoFocus={autofocus} />
                <CommandList>
                    <CommandEmpty className={`py-6 text-center text-sm select-none`}>
                        {t.userGroupPicker.noUserGroupFound}
                    </CommandEmpty>
                    <CommandGroup>
                        {userGroups.map((userGroup) => (
                            <CommandItem
                                key={userGroup.id}
                                value={userGroup.id}
                                className={`cursor-pointer`}
                                onSelect={() => this.handleSelect(userGroup)}
                            >
                                <div className={`flex items-center gap-2`}>
                                    <Users className={`h-4 w-4`} />
                                    <div className={`flex flex-col`}>
                                        <span className={`font-medium`}>
                                            {userGroup.name}
                                        </span>
                                        <span className={`text-muted-foreground text-xs`}>
                                            {userGroup.id}
                                        </span>
                                    </div>
                                </div>
                                <Check
                                    className={cn(
                                        `ml-auto h-4 w-4`,
                                        value?.id === userGroup.id
                                            ? `opacity-100`
                                            : `opacity-0`
                                    )}
                                />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
        );
    };

    render = () => {
        const {
            className,
            style,
            value,
            placeholder,
            triggerComponent,
            disabled = false,
            standalone = false
        } = this.props;
        const { open } = this.state;
        const { t } = this.context!;

        const displayPlaceholder = placeholder || t.userGroupPicker.selectUserGroup;

        if (standalone) {
            return (
                <div className={cn(className, `w-full`)} style={style}>
                    {this.renderContent()}
                </div>
            );
        }

        return (
            <Popover modal open={open} onOpenChange={this.handleOpenChange}>
                <PopoverTrigger asChild>
                    <div
                        className={cn(
                            className,
                            `flex w-full cursor-pointer items-center justify-between rounded-md border px-3 py-2`,
                            disabled && `pointer-events-none cursor-not-allowed opacity-50`
                        )}
                        style={style}
                        title={displayPlaceholder}
                    >
                        {triggerComponent || (
                            <>
                                <div className={`flex items-center gap-2`}>
                                    <Users className={`h-4 w-4`} />
                                    {value ? (
                                        <div className={`flex flex-col`}>
                                            <span className={`font-medium`}>
                                                {value.name}
                                            </span>
                                            <span className={`text-muted-foreground text-xs`}>
                                                {value.id}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className={`text-muted-foreground`}>
                                            {displayPlaceholder}
                                        </span>
                                    )}
                                </div>
                                <ChevronsUpDown className={`ml-2 h-4 w-4 opacity-50`} />
                            </>
                        )}
                    </div>
                </PopoverTrigger>
                <PopoverContent className={`w-[300px] p-0`}>
                    {this.renderContent()}
                </PopoverContent>
            </Popover>
        );
    };
}

export default withFilez(UserGroupPickerBase);
