import { Component } from "preact";
import { NavLink } from "react-router-dom";
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

interface NavBarProps {}
interface NavBarState {}
export default class NavBar extends Component<NavBarProps, NavBarState> {
    mapItems = (items: NavItem[]) => {
        return items.map((item, index) => {
            return (
                <li key={index}>
                    {/* @ts-ignore */}
                    <NavLink exact to={item.link}>
                        {item.name}
                    </NavLink>
                </li>
            );
        });
    };

    render = () => {
        return (
            <nav className="NavBar">
                <div className={"Desktop"}>
                    <div>
                        <ul>{this.mapItems(navUserItems)}</ul>
                    </div>
                    <div className={"dev"}>
                        <ul>{this.mapItems(navDevItems)}</ul>
                    </div>
                </div>
            </nav>
        );
    };
}
