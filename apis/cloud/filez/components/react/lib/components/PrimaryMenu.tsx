import { CSSProperties, PureComponent } from "react";
import {
    IoLanguageSharp,
    IoLogOutSharp,
    IoMoonSharp,
    IoPersonSharp,
    IoSettingsSharp
} from "react-icons/io5";

import { ImKeyboard } from "react-icons/im";

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
import { match } from "ts-pattern";
import { FilezContext, themePrefix } from "../FilezContext";
import CopyValueButton from "./atoms/CopyValueButton";

interface PrimaryMenuProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly defaultOpen?: boolean;
}

interface PrimaryMenuState {
    readonly filezUser?: FilezUser;
}

export default class PrimaryMenu extends PureComponent<PrimaryMenuProps, PrimaryMenuState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    menuOptions = [
        {
            groupName: "User",
            items: [
                {
                    label: "Profile",
                    icon: IoPersonSharp,
                    action: () => {}
                },
                {
                    label: "Logout",
                    icon: IoLogOutSharp,
                    action: () => this.logoutClick()
                }
            ]
        },
        {
            groupName: "Settings",
            items: [
                {
                    label: "Settings",
                    icon: IoSettingsSharp,
                    action: () => {}
                },
                {
                    label: "Language",
                    icon: IoLanguageSharp,
                    action: () => {}
                },
                {
                    label: "Theme",
                    icon: IoMoonSharp,
                    action: () => {
                        this.context?.setTheme(`${themePrefix}test`);
                    }
                },
                {
                    label: "Keyboard Shortcuts",
                    icon: ImKeyboard,
                    action: () => {}
                }
            ]
        }
    ];

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

        return (
            <div
                className={`PrimaryMenu fixed top-3 right-3 z-20 ${this.props.className ?? ""} text-foreground flex flex-col items-end gap-2`}
            >
                <DropdownMenu defaultOpen={this.props.defaultOpen}>
                    {match(loggedIn)
                        .with(true, () => (
                            <>
                                <DropdownMenuTrigger
                                    className={`bg-background border-border hover:border-foreground flex h-10 w-10 cursor-pointer items-center justify-center rounded-full outline-2`}
                                    title={`Logged in as ${userName}`}
                                >
                                    <span className="flex space-y-1 font-bold select-none">
                                        {userName ? (
                                            userName.charAt(0).toUpperCase()
                                        ) : (
                                            <Skeleton className="h-4 w-4" />
                                        )}
                                    </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>
                                        <div className="flex flex-col gap-1 px-4 py-2 pb-4">
                                            <span className="text-muted-foreground space-y-1 text-sm select-none">
                                                Signed in as
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
                                                        label="Copy User ID"
                                                        title="Copy User ID to clipboard"
                                                    />
                                                ) : (
                                                    <Skeleton className="h-4 w-full" />
                                                )}
                                            </div>
                                        </div>
                                    </DropdownMenuLabel>
                                    {this.menuOptions.map((group, groupIndex) => (
                                        <div key={`menu-group-${groupIndex}`}>
                                            {groupIndex > 0 && <DropdownMenuSeparator />}
                                            {group.items.map((item, itemIndex) => (
                                                <DropdownMenuItem
                                                    key={`menu-item-${itemIndex}`}
                                                    onClick={item.action}
                                                    className="flex items-center gap-2"
                                                >
                                                    <item.icon />
                                                    {item.label}
                                                </DropdownMenuItem>
                                            ))}
                                        </div>
                                    ))}
                                </DropdownMenuContent>
                            </>
                        ))
                        .with(false, () => (
                            <button
                                className="cursor-pointer rounded-full border-2 border-neutral-100 p-2 text-neutral-100"
                                onClick={this.loginClick}
                                title="PrimaryMenu"
                            >
                                Login
                            </button>
                        ))
                        .with(undefined, () => <></>)
                        .exhaustive()}
                </DropdownMenu>
            </div>
        );
    };
}
