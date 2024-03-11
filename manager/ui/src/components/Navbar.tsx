import { PureComponent } from "react";
import { Nav } from "rsuite";
import { NavLink } from "./Navlink";

interface NavbarProps {}

interface NavbarState {}

export default class Navbar extends PureComponent<NavbarProps, NavbarState> {
    navItems: { name: string; path: string }[];
    constructor(props: NavbarProps) {
        super(props);
        this.state = {};

        this.navItems = [
            { name: "Home", path: "/" },
            { name: "Dev", path: "/dev/" }
        ];
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div className="Navbar">
                <Nav appearance="subtle">
                    {this.navItems.map(item => {
                        return (
                            <Nav.Item key={item.path} as={NavLink} href={item.path}>
                                {item.name}
                            </Nav.Item>
                        );
                    })}
                </Nav>
            </div>
        );
    };
}
