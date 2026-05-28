import { MowsContext } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import { PureComponent, type ReactNode } from "react";
import { IoBug, IoHome } from "react-icons/io5";
import { NavLink } from "react-router-dom";

interface CustomNavbarProps {}

interface CustomNavbarState {}

interface NavItem {
    nameKey: `home` | `devtools`;
    path: string;
    icon?: ReactNode;
}

const navItems: NavItem[] = [
    { nameKey: `home`, path: `/`, icon: <IoHome size={`25`} /> },
    { nameKey: `devtools`, path: `/devtools/`, icon: <IoBug size={`25`} /> }
];

export default class CustomNavbar extends PureComponent<CustomNavbarProps, CustomNavbarState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    render = () => {
        const t = this.context!.t.manager.nav;
        return (
            <nav
                className={`CustomNavbar fixed flex h-[100vh] w-[60px] flex-col border-r bg-card text-foreground`}
            >
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end
                        className={({ isActive }) =>
                            `relative block transition-colors ${
                                isActive
                                    ? `text-foreground`
                                    : `text-foreground/60 hover:text-foreground`
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <div
                                className={`flex h-[60px] w-[60px] items-center justify-center`}
                                title={t[item.nameKey]}
                            >
                                {isActive && (
                                    <span
                                        aria-hidden
                                        className={`absolute inset-y-2 left-0 w-[3px] rounded-r bg-primary`}
                                    />
                                )}
                                <span
                                    className={
                                        isActive
                                            ? `flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground`
                                            : `flex h-10 w-10 items-center justify-center rounded-md`
                                    }
                                >
                                    {item.icon}
                                </span>
                            </div>
                        )}
                    </NavLink>
                ))}
            </nav>
        );
    };
}
