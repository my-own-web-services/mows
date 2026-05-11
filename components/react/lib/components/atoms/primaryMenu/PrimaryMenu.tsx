import Avatar from "@/components/atoms/avatar/Avatar";
import CodeThemePicker from "@/components/atoms/codeThemePicker/CodeThemePicker";
import CopyValueButton from "@/components/atoms/copyValueButton/CopyValueButton";
import LanguagePicker from "@/components/atoms/languagePicker/LanguagePicker";
import ThemePicker from "@/components/atoms/themePicker/ThemePicker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionVisibility } from "@/lib/mowsContext/ActionManager";
import { CoreActionIds, CoreModalTypes } from "@/lib/mowsContext/coreActions";
import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import { type CSSProperties, PureComponent, type ReactNode } from "react";
import { IoLogOutSharp, IoMenuSharp, IoPersonSharp, IoSettingsSharp } from "react-icons/io5";
import { LiaKeyboard } from "react-icons/lia";
import { PiUserSwitchFill } from "react-icons/pi";
import { match } from "ts-pattern";

export type PrimaryMenuPosition = `top-right` | `top-left` | `bottom-right` | `bottom-left`;

export interface PrimaryMenuUser {
    readonly displayName?: string | null;
    readonly id?: string | null;
}

export interface PrimaryMenuProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly defaultOpen?: boolean;
    readonly position?: PrimaryMenuPosition;
    readonly user?: PrimaryMenuUser;
    readonly loading?: boolean;
    readonly showSwitchUser?: boolean;
    readonly extraItems?: ReactNode;
}

interface PrimaryMenuState {
    readonly languagePickerOpen: boolean;
    readonly themePickerOpen: boolean;
    readonly codeThemePickerOpen: boolean;
    readonly menuOpen: boolean;
}

export default class PrimaryMenu extends PureComponent<PrimaryMenuProps, PrimaryMenuState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    constructor(props: PrimaryMenuProps) {
        super(props);
        this.state = {
            languagePickerOpen: false,
            themePickerOpen: false,
            codeThemePickerOpen: false,
            menuOpen: this.props.defaultOpen ?? false
        };
    }

    componentDidMount = () => {
        this.registerActionHandler();
    };

    componentDidUpdate = () => {
        this.registerActionHandler();
    };

    componentWillUnmount = () => {
        this.context?.actionManager?.unregisterActionHandler(
            CoreActionIds.OPEN_PRIMARY_MENU,
            `GlobalOpenPrimaryMenu`
        );
    };

    registerActionHandler = () => {
        this.context?.actionManager?.registerActionHandler(CoreActionIds.OPEN_PRIMARY_MENU, {
            id: `GlobalOpenPrimaryMenu`,
            getState: () => ({ visibility: ActionVisibility.Shown }),
            executeAction: () => {
                this.setState({ menuOpen: true });
            }
        });
    };

    loginClick = () => {
        this.context!.actionManager.dispatchAction(CoreActionIds.LOGIN);
    };

    logoutClick = () => {
        this.context!.actionManager.dispatchAction(CoreActionIds.LOGOUT);
    };

    positionClass = (): string => {
        switch (this.props.position) {
            case `top-left`:
                return `top-3 left-3`;
            case `bottom-right`:
                return `bottom-3 right-3`;
            case `bottom-left`:
                return `bottom-3 left-3`;
            case `top-right`:
            default:
                return `top-3 right-3`;
        }
    };

    render = () => {
        if (this.props.loading) return null;

        const ctx = this.context!;
        const { t } = ctx;
        const loggedIn = !!ctx.auth?.isAuthenticated;
        const userName = this.props.user?.displayName ?? undefined;
        const userId = this.props.user?.id ?? undefined;

        return (
            <div
                style={this.props.style}
                className={cn(
                    `PrimaryMenu fixed z-20 flex flex-col items-end gap-2 text-foreground`,
                    this.positionClass(),
                    this.props.className
                )}
            >
                <DropdownMenu
                    open={this.state.menuOpen}
                    onOpenChange={(open) => this.setState({ menuOpen: open })}
                >
                    {match(loggedIn)
                        .with(true, () => (
                            <DropdownMenuTrigger
                                className={`outline-0`}
                                title={`${t.primaryMenu.loggedInAs} ${userName ?? ``}`}
                            >
                                <Avatar displayName={userName} />
                            </DropdownMenuTrigger>
                        ))
                        .otherwise(() => (
                            <DropdownMenuTrigger
                                className={`outline-0`}
                                title={t.primaryMenu.openMenu}
                            >
                                <IoMenuSharp
                                    className={`h-10 w-10 cursor-pointer rounded-full border-2 border-foreground/40 p-2 text-foreground/70 hover:border-foreground hover:text-foreground`}
                                />
                            </DropdownMenuTrigger>
                        ))}

                    <DropdownMenuContent>
                        {match(loggedIn)
                            .with(true, () => (
                                <>
                                    <DropdownMenuLabel>
                                        <div className={`flex items-center`}>
                                            <Avatar
                                                className={`h-16 w-16 text-xl`}
                                                displayName={userName}
                                            />
                                            <div className={`flex flex-col gap-1 px-4 py-2 pb-4`}>
                                                <span
                                                    className={`space-y-1 text-sm text-muted-foreground select-none`}
                                                >
                                                    {t.primaryMenu.loggedInAs}
                                                </span>
                                                <span
                                                    className={`flex items-center gap-2 font-bold`}
                                                >
                                                    {userName ? (
                                                        userName
                                                    ) : (
                                                        <Skeleton className={`h-4 w-full`} />
                                                    )}
                                                </span>
                                                <div>
                                                    {userId ? (
                                                        <DropdownMenuItem
                                                            className={`p-0`}
                                                            asChild
                                                        >
                                                            <CopyValueButton
                                                                value={userId}
                                                                label={
                                                                    t.primaryMenu.copyUserId.label
                                                                }
                                                                title={
                                                                    t.primaryMenu.copyUserId.title
                                                                }
                                                            />
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <Skeleton className={`h-4 w-full`} />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </DropdownMenuLabel>

                                    <DropdownMenuItem
                                        className={`cursor-pointer`}
                                        onClick={this.logoutClick}
                                    >
                                        <IoLogOutSharp className={`h-4 w-4`} />
                                        <span>{t.primaryMenu.logout}</span>
                                    </DropdownMenuItem>
                                    {this.props.showSwitchUser && (
                                        <DropdownMenuItem
                                            className={`cursor-pointer`}
                                            onClick={this.logoutClick}
                                        >
                                            <PiUserSwitchFill className={`h-4 w-4`} />
                                            <span>{t.primaryMenu.switchUser}</span>
                                        </DropdownMenuItem>
                                    )}
                                </>
                            ))
                            .with(false, () => (
                                <DropdownMenuItem
                                    className={`cursor-pointer`}
                                    onClick={this.loginClick}
                                >
                                    <IoPersonSharp className={`h-4 w-4`} />
                                    <span>{t.primaryMenu.login}</span>
                                </DropdownMenuItem>
                            ))
                            .exhaustive()}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className={`select-none`}>
                            {t.primaryMenu.language}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                            onSelect={(e) => {
                                e.preventDefault();
                                this.setState({ languagePickerOpen: true });
                            }}
                            asChild
                        >
                            <LanguagePicker
                                defaultOpen={this.state.languagePickerOpen}
                                onValueChange={() => this.setState({ languagePickerOpen: false })}
                            />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className={`select-none`}>
                            {t.primaryMenu.theme}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                            onSelect={(e) => {
                                e.preventDefault();
                                this.setState({ themePickerOpen: true });
                            }}
                            asChild
                        >
                            <ThemePicker
                                defaultOpen={this.state.themePickerOpen}
                                onValueChange={() => this.setState({ themePickerOpen: false })}
                            />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className={`select-none`}>
                            {t.codeThemePicker.label}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                            onSelect={(e) => {
                                e.preventDefault();
                                this.setState({ codeThemePickerOpen: true });
                            }}
                            asChild
                        >
                            <CodeThemePicker
                                defaultOpen={this.state.codeThemePickerOpen}
                                onValueChange={() => this.setState({ codeThemePickerOpen: false })}
                            />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className={`cursor-pointer`}
                            onClick={() => {
                                ctx.changeActiveModal(CoreModalTypes.keyboardShortcutEditor);
                            }}
                        >
                            <LiaKeyboard />
                            <span>{t.keyboardShortcuts.label}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className={`cursor-pointer`}
                            onClick={() => {
                                ctx.changeActiveModal(CoreModalTypes.settings);
                            }}
                        >
                            <IoSettingsSharp />
                            <span>{t.settings.title}</span>
                        </DropdownMenuItem>
                        {this.props.extraItems}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    };
}
