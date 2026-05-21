import Avatar from "@/components/identity/avatar/Avatar";
import CodeThemePicker from "@/components/code/codeThemePicker/CodeThemePicker";
import CopyValueButton from "@/components/input/copyValueButton/CopyValueButton";
import LanguagePicker from "@/components/settings/languagePicker/LanguagePicker";
import ThemePicker from "@/components/settings/themePicker/ThemePicker";
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
import { ChevronsUpDown } from "lucide-react";
import { type CSSProperties, PureComponent, type ReactNode } from "react";
import {
    IoLogOutSharp,
    IoMenuSharp,
    IoPersonSharp,
    IoSettingsSharp
} from "react-icons/io5";
import { LiaKeyboard } from "react-icons/lia";
import { PiUserSwitchFill } from "react-icons/pi";
import { match } from "ts-pattern";

export type PrimaryMenuPosition = `top-right` | `top-left` | `bottom-right` | `bottom-left`;

export type PrimaryMenuVariant = `fixed` | `inline`;

export interface PrimaryMenuUser {
    readonly displayName?: string | null;
    readonly id?: string | null;
}

export interface PrimaryMenuProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly defaultOpen?: boolean;
    readonly position?: PrimaryMenuPosition;
    readonly variant?: PrimaryMenuVariant;
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
        const authConfigured = ctx.authConfigured;
        const loggedIn = authConfigured && !!ctx.auth?.isAuthenticated;
        const userName = this.props.user?.displayName ?? undefined;
        const userId = this.props.user?.id ?? undefined;
        const variant = this.props.variant ?? `fixed`;
        const inline = variant === `inline`;

        // Inline variant is a full-width footer bar with a top divider so it
        // can sit edge-to-edge at the bottom of a sidebar column without the
        // caller having to spend an extra `<SidebarFooter>` or strip its
        // default padding. No `bg-…` on the wrapper at rest — it inherits
        // from the surrounding sidebar so the bar is just "the sidebar
        // bottom" visually, with only the top hairline marking the
        // boundary. The hover/focus highlight is driven by the wrapper
        // (not the inner DropdownMenuTrigger) and CSS `:has(:hover)` /
        // `:has(:focus-visible)`, so the whole bar lights up as a single
        // button area regardless of where the cursor lands inside it.
        const wrapperClasses = inline
            ? `PrimaryMenu flex w-full items-stretch border-t border-sidebar-border cursor-pointer transition-colors has-[button:hover]:bg-sidebar-accent has-[button:hover]:text-sidebar-accent-foreground has-[button:focus-visible]:bg-sidebar-accent has-[button:focus-visible]:text-sidebar-accent-foreground has-[button[data-state=open]]:bg-sidebar-accent has-[button[data-state=open]]:text-sidebar-accent-foreground`
            : cn(
                  `PrimaryMenu fixed z-20 flex flex-col items-end gap-2 text-foreground`,
                  this.positionClass()
              );

        const triggerClasses = inline
            ? `outline-0 flex w-full items-center gap-2 px-3 py-3 text-sm text-left cursor-pointer`
            : `outline-0`;

        return (
            <div
                style={this.props.style}
                className={cn(wrapperClasses, this.props.className)}
            >
                <DropdownMenu
                    open={this.state.menuOpen}
                    onOpenChange={(open) => this.setState({ menuOpen: open })}
                >
                    {match(loggedIn)
                        .with(true, () => (
                            <DropdownMenuTrigger
                                className={triggerClasses}
                                title={`${t.primaryMenu.loggedInAs} ${userName ?? ``}`}
                            >
                                <Avatar
                                    displayName={userName}
                                    className={inline ? `h-7 w-7 text-xs` : undefined}
                                />
                                {inline && (
                                    <>
                                        <span className={`flex-1 truncate font-medium`}>
                                            {userName ?? ``}
                                        </span>
                                        <ChevronsUpDown
                                            className={`h-4 w-4 shrink-0 text-sidebar-foreground/60`}
                                            aria-hidden
                                        />
                                    </>
                                )}
                            </DropdownMenuTrigger>
                        ))
                        .otherwise(() => (
                            <DropdownMenuTrigger
                                className={triggerClasses}
                                title={t.primaryMenu.openMenu}
                            >
                                <IoMenuSharp
                                    className={cn(
                                        `cursor-pointer`,
                                        // Inline mode lets the wrapper drive
                                        // the full-bar highlight (via
                                        // `has-[button:hover]`), so the icon
                                        // itself stays at the same colour as
                                        // surrounding sidebar text — no
                                        // double-bright "icon-only" hover.
                                        // Fixed mode is a free-floating
                                        // circular trigger with no wrapper
                                        // highlight, so the icon owns its
                                        // own hover affordance.
                                        inline
                                            ? `h-5 w-5 text-sidebar-foreground/70`
                                            : `h-7 w-7 text-foreground/70 hover:text-foreground`
                                    )}
                                />
                                {inline && (
                                    <>
                                        <span className={`flex-1`} aria-hidden />
                                        <ChevronsUpDown
                                            className={`h-4 w-4 shrink-0 text-sidebar-foreground/60`}
                                            aria-hidden
                                        />
                                    </>
                                )}
                            </DropdownMenuTrigger>
                        ))}

                    <DropdownMenuContent
                        side={inline ? `top` : undefined}
                        align={inline ? `start` : undefined}
                    >
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
                            .with(false, () =>
                                authConfigured ? (
                                    <DropdownMenuItem
                                        className={`cursor-pointer`}
                                        onClick={this.loginClick}
                                    >
                                        <IoPersonSharp className={`h-4 w-4`} />
                                        <span>{t.primaryMenu.login}</span>
                                    </DropdownMenuItem>
                                ) : null
                            )
                            .exhaustive()}
                        {(loggedIn || authConfigured) && <DropdownMenuSeparator />}
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
