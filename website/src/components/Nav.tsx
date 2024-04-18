import { Component } from "preact";
import { IoChevronUp, IoClose, IoMenu } from "react-icons/io5";
import { NavLink } from "react-router-dom";
import TableOfContents from "../pages/project/TableOfContents";
import { VscGithub } from "react-icons/vsc";
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
        name: "Github",
        link: "https://github.com/my-own-web-services/mows",
        external: true,
        icon: (
            <div className={""}>
                <VscGithub size={20} />
            </div>
        )
    }
];

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
                <li key={index} className={"mx-3 lg:mx-5"}>
                    {item.external ? (
                        <a rel={"noreferrer noopener"} href={item.link} className={"text-primary"}>
                            {item.icon ? item.icon : item.name}
                        </a>
                    ) : (
                        /* @ts-ignore */
                        <NavLink
                            className={
                                "no-underline uppercase text-primary  font-semibold px-[2px]"
                            }
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

    flipMenu = () => {
        this.setState({ isMenuOpen: !this.state.isMenuOpen });
    };

    onMobileTableFlip = () => {
        this.setState({ isTableOpen: false });
    };

    render = () => {
        return (
            <nav
                className={`md:static fixed bottom-0 left-0 w-[100vw] md:w-full md:mt-10 z-10 border-t-2 border-t-primary box-content md:border-t-0 bg-background md:bg-none transition-all ease duration-300 ${
                    this.state.isMenuOpen ? "h-1/2" : "h-16"
                }`}
            >
                <div className={"hidden h-full w-full md:block"}>
                    <ul className={"flex h-full w-full justify-center"}>
                        {this.mapItems(navUserItems)}
                    </ul>
                </div>
                <div className={"md:hidden w-full h-16 bottom-0 absolute bg-background"}>
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
                <div
                    className={`${
                        this.state.isTableOpen ? "flex" : "hidden"
                    }  w-full p-5 h-10  justify-between`}
                >
                    <TableOfContents mode="desktop" />
                </div>
                <div
                    className={`${
                        this.state.isMenuOpen ? "flex" : "hidden"
                    } w-full p-5 justify-between`}
                >
                    <ul>{this.mapItems(navUserItems, this.flipMenu)}</ul>
                </div>
            </nav>
        );
    };
}
