// @ts-nocheck
import { Component } from "preact";
import { Link } from "preact-router/match";
import { CSSProperties } from "preact/compat";
import { IoMenuSharp } from "react-icons/io5";

interface NavProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface NavState {
    readonly mobileMenuOpen: boolean;
}

const menuItems = [
    {
        element: (
            <Link activeClassName="active" href="/" className={"font-bold"}>
                filez
            </Link>
        )
    }
];

export default class Nav extends Component<NavProps, NavState> {
    constructor(props: NavProps) {
        super(props);
        this.state = {
            mobileMenuOpen: false
        };
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <nav style={{ ...this.props.style }} className={`Nav ${this.props.className ?? ""} `}>
                <div className={"hidden gap-8 border-b-2 bg-zinc-900 p-4 text-xl md:flex"}>
                    {menuItems.map((item, index) => (
                        <div key={index} className="text-lg">
                            {item.element}
                        </div>
                    ))}
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
