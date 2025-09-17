import { CSSProperties, PureComponent } from "react";
import { IoPersonSharp, IoSettingsSharp } from "react-icons/io5";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { FilezUser } from "filez-client-typescript";
import { withTranslation } from "react-i18next";
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

interface PrimaryMenuState {
    readonly filezUser?: FilezUser;
}

class PrimaryMenu extends PureComponent<PrimaryMenuProps, PrimaryMenuState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: PrimaryMenuProps) {
        super(props);
        this.state = {
            filezUser: undefined
        };
    }

    componentDidMount = async () => {
        await this.reloadUserInfo();
    };

    componentDidUpdate = async () => {
        if (this.state.filezUser === undefined) {
            await this.reloadUserInfo();
        }
    };

    reloadUserInfo = async () => {
        if (this.context?.filezClient !== null && this.context?.auth?.isAuthenticated) {
            const response = await this.context?.filezClient.api.getOwnUser();
            this.setState({ filezUser: response?.data?.data?.user });
        }
    };

    loginClick = async () => {
        const redirect_uri = new URLSearchParams(window.location.search).get("redirect_uri");
        if (redirect_uri) {
            localStorage.setItem("redirect_uri", redirect_uri);
        }

        this.context?.auth?.signinRedirect();
    };

    logoutClick = async () => {
        this.context?.auth?.signoutRedirect();
    };

    render = () => {
        const loggedIn = this.context?.auth?.isAuthenticated;
        const loading = this.context?.auth?.isLoading;
        if (loading) {
            return <></>;
        }

        const userName = this.state.filezUser?.display_name;
        const userId = this.state.filezUser?.id;

        const { t } = this.props;

        return (
            <div
                className={`PrimaryMenu fixed top-3 right-3 z-20 ${this.props.className ?? ""} text-foreground flex flex-col items-end gap-2`}
            >
                <DropdownMenu defaultOpen={this.props.defaultOpen}>
                    {match(loggedIn)
                        .with(true, () => (
                            <>
                                <DropdownMenuTrigger
                                    className="outline-0"
                                    title={`Logged in as ${userName}`}
                                >
                                    <Avatar filezUser={this.state.filezUser} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>
                                        <div className="flex items-center">
                                            <Avatar
                                                className="h-16 w-16 text-xl"
                                                filezUser={this.state.filezUser}
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
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                        <IoPersonSharp className="h-4 w-4" />
                                        <span>{t("primaryMenu.profile")}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <IoSettingsSharp className="h-4 w-4" />
                                        <span>{t("primaryMenu.settings")}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel>
                                        {t("primaryMenu.language")}
                                    </DropdownMenuLabel>
                                    <LanguagePicker className="w-full" style={{}} />
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel>{t("primaryMenu.theme")}</DropdownMenuLabel>
                                    <ThemePicker className="w-full" style={{}} />
                                </DropdownMenuContent>
                            </>
                        ))
                        .with(false, () => (
                            <button
                                className="cursor-pointer rounded-full border-2 border-neutral-100 p-2 text-neutral-100"
                                onClick={this.loginClick}
                                title="PrimaryMenu"
                            >
                                {t("primaryMenu.signIn")}
                            </button>
                        ))
                        .with(undefined, () => <></>)
                        .exhaustive()}
                </DropdownMenu>
            </div>
        );
    };
}

export default withTranslation()(PrimaryMenu);
