import { PureComponent } from "react";
import { IoBug, IoHome } from "react-icons/io5";
import { NavLink } from "react-router-dom";

interface CustomNavbarProps {}

interface CustomNavbarState {}

interface NavItem {
    name: string;
    path: string;
    icon?: JSX.Element;
}

const navItems: NavItem[] = [
    { name: "Home", path: "/", icon: <IoHome size="25" /> },
    { name: "Devtools", path: "/devtools/", icon: <IoBug size="25" /> }
];

export default class CustomNavbar extends PureComponent<CustomNavbarProps, CustomNavbarState> {
    constructor(props: CustomNavbarProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <nav className="CustomNavbar fixed flex h-[100vh] w-[60px] flex-col bg-nightSky10">
                {navItems.map((item) => {
                    return (
                        //@ts-ignore
                        <NavLink
                            activeClassName="active"
                            to={item.path}
                            className={"text-paper10"}
                            exact
                        >
                            <div
                                className="flex h-[60px] w-[60px] items-center justify-center hover:text-bavarianBlue"
                                title={item.name}
                            >
                                {item.icon}
                            </div>{" "}
                        </NavLink>
                    );
                })}
            </nav>
        );
    };
}
