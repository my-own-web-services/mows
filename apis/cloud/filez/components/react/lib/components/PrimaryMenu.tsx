import { CSSProperties, PureComponent } from "react";
import { IoCodeSlashSharp, IoLogOutSharp, IoMenuSharp, IoPersonSharp } from "react-icons/io5";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, filezPostLoginRedirectPathLocalStorageKey } from "@/lib/utils";
import { withTranslation } from "react-i18next";
import { PiUserSwitchFill } from "react-icons/pi";
import { match } from "ts-pattern";
import { FilezContext } from "../FilezContext";
import Avatar from "./atoms/Avatar";
import CopyValueButton from "./atoms/CopyValueButton";
import LanguagePicker from "./atoms/LanguagePicker";
import ThemePicker from "./atoms/ThemePicker";

interface PrimaryMenuProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly defaultOpen?: boolean;
    readonly t: (key: string) => string;
}

interface PrimaryMenuState {}

class PrimaryMenu extends PureComponent<PrimaryMenuProps, PrimaryMenuState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: PrimaryMenuProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    componentDidUpdate = async () => {};

    loginClick = async () => {
        const redirect_uri = window.location.pathname + window.location.search;
        localStorage.setItem(filezPostLoginRedirectPathLocalStorageKey, redirect_uri);

        this.context?.auth?.signinRedirect();
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

        const { t } = this.props;

        return (
            <div
                className={cn(
                    `PrimaryMenu text-foreground fixed top-3 right-3 z-20 flex flex-col items-end gap-2`,
                    this.props.className
                )}
            >
                <DropdownMenu defaultOpen={this.props.defaultOpen}>
                    {match(loggedIn)
                        .with(true, () => (
                            <DropdownMenuTrigger
                                className="outline-0"
                                title={`${t("primaryMenu.loggedInAs")} ${userName}`}
                            >
                                <Avatar filezUser={this.context?.ownFilezUser!} />
                            </DropdownMenuTrigger>
                        ))
                        .otherwise(() => (
                            <DropdownMenuTrigger
                                className="outline-0"
                                title={t("primaryMenu.openMenu")}
                            >
                                <IoMenuSharp className="h-10 w-10 cursor-pointer rounded-full border-2 border-neutral-100 p-2 text-neutral-100" />
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
                                                    {this.props.t("primaryMenu.loggedInAs")}
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
                                                        <CopyValueButton
                                                            value={userId}
                                                            label={t(
                                                                "primaryMenu.copyUserId.label"
                                                            )}
                                                            title={t(
                                                                "primaryMenu.copyUserId.title"
                                                            )}
                                                        />
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
                                        <span>{t("primaryMenu.logout")}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={this.logoutClick}
                                    >
                                        <PiUserSwitchFill className="h-4 w-4" />
                                        <span>{t("primaryMenu.switchUser")}</span>
                                    </DropdownMenuItem>
                                </>
                            ))
                            .with(false, () => (
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={this.loginClick}
                                >
                                    <IoPersonSharp className="h-4 w-4" />
                                    <span>{t("primaryMenu.login")}</span>
                                </DropdownMenuItem>
                            ))
                            .exhaustive()}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="select-none">
                            {t("primaryMenu.language")}
                        </DropdownMenuLabel>
                        <LanguagePicker className="w-full" style={{}} />
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="select-none">
                            {t("primaryMenu.theme")}
                        </DropdownMenuLabel>
                        <ThemePicker className="w-full" style={{}} />
                        <DropdownMenuSeparator />

                        <DropdownMenuLabel className="select-none">
                            {t("primaryMenu.developer")}
                        </DropdownMenuLabel>

                        <DropdownMenuItem className="cursor-pointer">
                            <IoCodeSlashSharp className="inline h-4 w-4" />
                            <span> {t("primaryMenu.developerTools")}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    };
}

export default withTranslation()(PrimaryMenu);
