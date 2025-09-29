import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionIds } from "@/lib/defaultActions";
import { log } from "@/lib/logging";
import { cn, signinRedirectSavePath } from "@/lib/utils";
import { type CSSProperties, PureComponent } from "react";
import { IoCodeSlashSharp, IoLogOutSharp, IoMenuSharp, IoPersonSharp } from "react-icons/io5";
import { LiaKeyboard } from "react-icons/lia";
import { PiUserSwitchFill } from "react-icons/pi";
import { match } from "ts-pattern";
import { FilezContext } from "../lib/filezContext/FilezContext";
import Avatar from "./atoms/Avatar";
import CopyValueButton from "./atoms/CopyValueButton";
import LanguagePicker from "./atoms/LanguagePicker";
import ThemePicker from "./atoms/ThemePicker";

interface PrimaryMenuProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly defaultOpen?: boolean;
    readonly position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

interface PrimaryMenuState {
    readonly languagePickerOpen: boolean;
    readonly themePickerOpen: boolean;
    readonly keyboardShortcutsOpen: boolean;
    readonly menuOpen?: boolean;
}

export default class PrimaryMenu extends PureComponent<PrimaryMenuProps, PrimaryMenuState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: PrimaryMenuProps) {
        super(props);
        this.state = {
            languagePickerOpen: false,
            themePickerOpen: false,
            keyboardShortcutsOpen: false,
            menuOpen: this.props.defaultOpen ?? false
        };
    }

    componentDidMount = async () => {};

    componentDidUpdate = async () => {
        if (
            this.context?.actionManager &&
            !this.context?.actionManager.handlerExists(ActionIds.OPEN_PRIMARY_MENU)
        ) {
            this.context?.actionManager?.setHandler(ActionIds.OPEN_PRIMARY_MENU, () => {
                this.setState({ menuOpen: true });
            });
        }
    };

    loginClick = async () => {
        if (!this.context?.auth?.signinRedirect) {
            log.error("No signinRedirect function available");
            return;
        }
        await signinRedirectSavePath(this.context?.auth?.signinRedirect);
    };

    logoutClick = async () => {
        this.context?.auth?.removeUser();
    };

    render = () => {
        const loggedIn = !!this.context?.auth?.isAuthenticated;
        if (this.context?.clientLoading) {
            return <></>;
        }

        const userName = this.context?.ownFilezUser?.display_name;
        const userId = this.context?.ownFilezUser?.id;

        const { t } = this.context!;

        const positionClass = (() => {
            switch (this.props.position) {
                case "top-left":
                    return "top-3 left-3";
                case "bottom-right":
                    return "bottom-3 right-3";
                case "bottom-left":
                    return "bottom-3 left-3";
                case "top-right":
                default:
                    return "top-3 right-3";
            }
        })();

        return (
            <div
                className={cn(
                    `PrimaryMenu text-foreground fixed ${positionClass} z-20 flex flex-col items-end gap-2`,
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
                                className="outline-0"
                                title={`${t.primaryMenu.loggedInAs} ${userName}`}
                            >
                                <Avatar filezUser={this.context?.ownFilezUser!} />
                            </DropdownMenuTrigger>
                        ))
                        .otherwise(() => (
                            <DropdownMenuTrigger
                                className="outline-0"
                                title={t.primaryMenu.openMenu}
                            >
                                <IoMenuSharp className="border-primary text-primary h-10 w-10 cursor-pointer rounded-full border-2 p-2" />
                            </DropdownMenuTrigger>
                        ))}

                    <DropdownMenuContent>
                        {match(loggedIn)
                            .with(true, () => (
                                <>
                                    <DropdownMenuLabel>
                                        <div className="flex items-center">
                                            <Avatar
                                                className="h-16 w-16 text-xl"
                                                filezUser={this.context?.ownFilezUser!}
                                            />
                                            <div className="flex flex-col gap-1 px-4 py-2 pb-4">
                                                <span className="text-muted-foreground space-y-1 text-sm select-none">
                                                    {t.primaryMenu.loggedInAs}
                                                </span>
                                                <span className="flex items-center gap-2 font-bold">
                                                    {userName ? (
                                                        userName
                                                    ) : (
                                                        <Skeleton className="h-4 w-full" />
                                                    )}
                                                </span>
                                                <div className="">
                                                    {userId ? (
                                                        <DropdownMenuItem className="p-0" asChild>
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
                                                        <Skeleton className="h-4 w-full" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </DropdownMenuLabel>

                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={this.logoutClick}
                                    >
                                        <IoLogOutSharp className="h-4 w-4" />
                                        <span>{t.primaryMenu.logout}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={this.logoutClick}
                                    >
                                        <PiUserSwitchFill className="h-4 w-4" />
                                        <span>{t.primaryMenu.switchUser}</span>
                                    </DropdownMenuItem>
                                </>
                            ))
                            .with(false, () => (
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={this.loginClick}
                                >
                                    <IoPersonSharp className="h-4 w-4" />
                                    <span>{t.primaryMenu.login}</span>
                                </DropdownMenuItem>
                            ))
                            .exhaustive()}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="select-none">
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
                        <DropdownMenuLabel className="select-none">
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
                        <DropdownMenuItem
                            onClick={() => {
                                this.context?.changeActiveModal("keyboardShortcutEditor");
                            }}
                            className="cursor-pointer"
                        >
                            <LiaKeyboard></LiaKeyboard>
                            <span>{t.keyboardShortcuts.label}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />

                        <DropdownMenuLabel className="select-none">
                            {t.primaryMenu.developer}
                        </DropdownMenuLabel>

                        <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => {
                                history.pushState({}, "", "/dev/");
                            }}
                        >
                            <IoCodeSlashSharp className="inline h-4 w-4" />
                            <span> {t.primaryMenu.developerTools}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    };
}
