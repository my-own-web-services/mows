import { Component } from "preact";
import { IoChevronUp, IoClose, IoMenu } from "react-icons/io5";
import { NavLink } from "react-router-dom";
import TableOfContents from "../pages/project/TableOfContents";
export interface NavItem {
    name: string;
    link: string;
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
        name: "Apps",
        link: "/apps"
    },
    {
        name: "Hardware",
        link: "/hardware"
    }
];

const navDevItems: NavItem[] = [
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

    mapItems = (items: NavItem[]) => {
        return items.map((item, index) => {
            return (
                <li key={index}>
                    {/* @ts-ignore */}
                    <NavLink
                        className={"no-underline uppercase text-primary mx-5 font-bold px-[2px]"}
                        exact
                        to={item.link}
                        onClick={this.flipMenu}
                    >
                        {item.name}
                    </NavLink>
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
                className={`md:static fixed bottom-0 left-0 w-full md:mt-10 z-10 border-t-2 border-t-primary box-content md:border-t-0 bg-background md:bg-none ${
                    this.state.isMenuOpen ? "h-1/2" : "h-16"
                }`}
            >
                <div className={"hidden h-full md:flex md:justify-between"}>
                    <ul className={"flex h-full"}>{this.mapItems(navUserItems)}</ul>
                    <ul className={"flex h-full"}>{this.mapItems(navDevItems)}</ul>
                </div>
                <div className={"md:hidden w-full h-16 bottom-0 absolute bg-background"}>
                    <div className={"flex w-full h-full justify-between items-center"}>
                        <div>
                            <button
                                onClick={this.flipMenu}
                                className={`${this.state.isMenuOpen ? "hidden" : "block"} mx-5`}
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
                                    window.scrollTo(0, 0);
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
                    <ul>{this.mapItems(navUserItems)}</ul>
                    <ul>{this.mapItems(navDevItems)}</ul>
                </div>
            </nav>
        );
    };
}
