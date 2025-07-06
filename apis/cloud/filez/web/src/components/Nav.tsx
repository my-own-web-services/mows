import { Component } from "preact";
import { Link } from "preact-router/match";
import { CSSProperties } from "preact/compat";
import { IoLogOutSharp, IoMenuSharp } from "react-icons/io5";
import { AuthContextProps, withAuth } from "react-oidc-context";

interface NavProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly auth?: AuthContextProps;
}

interface NavState {
    readonly mobileMenuOpen: boolean;
}

const menuItems = [
    {
        element: (
            //@ts-ignore
            <Link activeClassName="active" href="/" className={"font-bold"}>
                filez
            </Link>
        )
    },
    {
        element: (
            //@ts-ignore
            <Link activeClassName="active" href="/dev" className={"font-bold"}>
                dev
            </Link>
        )
    }
];

class Nav extends Component<NavProps, NavState> {
    constructor(props: NavProps) {
        super(props);
        this.state = {
            mobileMenuOpen: false
        };
    }

    componentDidMount = async () => {};

    login = async () => {
        localStorage.setItem("redirect_uri", window.location.href);

        this.props.auth?.signinRedirect();
    };
    logout = async () => {
        await this.props.auth?.removeUser();
    };

    render = () => {
        return (
            <nav style={{ ...this.props.style }} className={`Nav ${this.props.className ?? ""} `}>
                <div className={"hidden border-b-2 bg-zinc-900 p-4 text-xl md:flex"}>
                    <div className={"flex gap-8"}>
                        {menuItems.map((item, index) => (
                            <div key={index} className="text-lg">
                                {item.element}
                            </div>
                        ))}
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                        {this.props.auth?.user ? (
                            <button onClick={this.logout} className={"flex items-center gap-2"}>
                                <span className="text-lg font-bold">
                                    {this.props.auth.user?.profile.name}
                                </span>
                                <span>
                                    <IoLogOutSharp></IoLogOutSharp>
                                </span>
                            </button>
                        ) : (
                            <button onClick={this.login} className="text-lg font-bold">
                                Login
                            </button>
                        )}
                    </div>
                </div>
                <div
                    className={`fixed bottom-0 left-0 right-0 z-10 flex min-h-12 w-full justify-center border-t-2 bg-zinc-900 md:hidden`}
                >
                    <div
                        className={`flex flex-col gap-2 p-4 pb-12 text-center md:hidden ${this.state.mobileMenuOpen ? "block" : "hidden"}`}
                    >
                        {menuItems.map((item, index) => (
                            <div key={index} className="text-lg">
                                {item.element}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            this.setState({ mobileMenuOpen: !this.state.mobileMenuOpen });
                        }}
                        className={"absolute bottom-0 p-3"}
                        aria-label={"mobile menu"}
                    >
                        <IoMenuSharp size={26} />
                    </button>
                </div>
            </nav>
        );
    };
}

export default withAuth(Nav);
