import { Component } from "preact";
import {
    IoChevronUp,
    IoClose,
    IoLogoMastodon,
    IoLogoTwitch,
    IoLogoYoutube,
    IoMenu
} from "react-icons/io5";
import { NavLink } from "react-router-dom";
import TableOfContents from "../pages/project/TableOfContents";
import { VscGithub } from "react-icons/vsc";
import { signal } from "@preact/signals";
import Toggle from "./Toggle";
import { MdAnimation } from "react-icons/md";
import { JSX } from "preact";

export interface NavItem {
    name: string;
    link: string;
    external?: boolean;
    icon?: JSX.Element;
}

const navUserItems: NavItem[] = [
    {
        name: "Project",
        link: "/"
    },
    {
        name: "Install",
        link: "/install"
    },
    {
        name: "Manager",
        link: "/dev/manager"
    },
    {
        name: "Operator",
        link: "/dev/operator"
    },
    {
        name: "APIs",
        link: "/dev/apis"
    },
    {
        name: "Hardware",
        link: "/dev/hardware"
    },
    {
        name: "Apps",
        link: "/dev/apps"
    },
    {
        name: "GitHub",
        link: "https://github.com/my-own-web-services/mows",
        external: true,
        icon: (
            <div className={"w-0"}>
                <VscGithub size={20} />
            </div>
        )
    },
    {
        name: "Mastodon",
        link: "https://mastodon.social/@mows",
        external: true,
        icon: (
            <div className={"w-0"}>
                <IoLogoMastodon size={20} />
            </div>
        )
    },
    {
        name: "YouTube",
        link: "https://www.youtube.com/@my-own-web-services",
        external: true,
        icon: (
            <div className={"w-0"}>
                <IoLogoYoutube size={20} />
            </div>
        )
    },
    {
        name: "Twitch",
        link: "https://www.twitch.tv/myownwebservices",
        external: true,
        icon: (
            <div className={"w-0"}>
                <IoLogoTwitch size={20} />
            </div>
        )
    }
];

export const animationsEnabled = signal(true);

interface NavProps {}
interface NavState {
    readonly isMenuOpen: boolean;
    readonly isTableOpen: boolean;
}
export default class Nav extends Component<NavProps, NavState> {
    constructor(props: NavProps) {
        super(props);
        this.state = {
            isMenuOpen: false,
            isTableOpen: false
        };
    }

    mapItems = (items: NavItem[], onClick?: () => void) => {
        return items.map((item, index) => {
            return (
                <li key={index} className={"mx-3 my-2 lg:mx-5 lg:my-0"}>
                    {item.external ? (
                        <a rel={"noreferrer noopener"} href={item.link} className={"text-primary"}>
                            {item.icon ? item.icon : item.name}
                        </a>
                    ) : (
                        /* @ts-ignore */
                        <NavLink
                            className={"no-underline uppercase text-primary font-semibold px-[2px]"}
                            exact
                            to={item.link}
                            onClick={onClick}
                        >
                            {item.icon ? item.icon : item.name}
                        </NavLink>
                    )}
                </li>
            );
        });
    };

    DesktopNav = () => {
        return (
            <div className={"hidden h-full w-full lg:block"}>
                <ul className={"flex h-full w-full justify-center"}>
                    {this.mapItems(navUserItems)}
                </ul>
            </div>
        );
    };

    MobileBottomBar = () => {
        return (
            <div className={"lg:hidden w-full h-16 bottom-0 absolute bg-background"}>
                <div className={"flex w-full h-full justify-between items-center"}>
                    <div>
                        <button
                            onClick={this.flipMenu}
                            className={`${this.state.isMenuOpen ? "hidden" : "block"} mx-5 `}
                        >
                            <IoMenu size={35} />
                        </button>
                        <button
                            onClick={this.flipMenu}
                            className={`${this.state.isMenuOpen ? "block" : "hidden"} mx-5`}
                        >
                            <IoClose size={35} />
                        </button>
                    </div>
                    <TableOfContents
                        mode="mobile"
                        className="flex-grow max-w-56"
                        onExpandFlip={this.onMobileTableFlip}
                    />
                    <div>
                        <button
                            onClick={() => {
                                window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className={"mx-5"}
                        >
                            <IoChevronUp size={35} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    MobileNavWindow = () => {
        return (
            <div
                className={`${
                    this.state.isMenuOpen ? "flex" : "hidden"
                } w-full p-5 justify-between lg:hidden`}
            >
                <ul>{this.mapItems(navUserItems, this.flipMenu)}</ul>
                <Toggle
                    checked={animationsEnabled.value}
                    onClick={() => {
                        animationsEnabled.value = !animationsEnabled.value;
                    }}
                    title="Toggle animations"
                >
                    Animations
                </Toggle>
            </div>
        );
    };

    flipMenu = () => {
        this.setState({ isMenuOpen: !this.state.isMenuOpen });
    };

    onMobileTableFlip = () => {
        this.setState({ isTableOpen: false });
    };

    render = () => {
        return (
            <nav
                className={`lg:static fixed bottom-0 left-0 w-[100vw] md:w-full lg:mt-10 z-10 border-t-2 border-t-primary box-content lg:border-t-0 bg-background lg:bg-none transition-all ease duration-300 ${
                    this.state.isMenuOpen ? "h-1/2" : "h-16"
                }`}
            >
                {this.DesktopNav()}

                {this.MobileBottomBar()}

                <div
                    className={`${
                        this.state.isTableOpen ? "flex" : "hidden"
                    }  w-full p-5 h-10  justify-between`}
                >
                    <TableOfContents mode="desktop" />
                </div>
                {this.MobileNavWindow()}
            </nav>
        );
    };
}
