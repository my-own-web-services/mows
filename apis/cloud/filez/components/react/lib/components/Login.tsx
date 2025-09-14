import { CSSProperties, PureComponent, RefObject, createRef } from "react";
import { PiSignOutBold } from "react-icons/pi";
import { match } from "ts-pattern";
import { FilezContext } from "../FilezContext";

interface LoginProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly expandedDefault?: boolean;
}

interface LoginState {
    expanded: boolean;
}

export default class Login extends PureComponent<LoginProps, LoginState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    private containerRef: RefObject<HTMLDivElement | null>;

    constructor(props: LoginProps) {
        super(props);
        this.state = {
            expanded: this.props.expandedDefault ?? false
        };
        this.containerRef = createRef<HTMLDivElement>();
    }

    componentDidMount = async () => {
        document.addEventListener("mousedown", this.handleClickOutside);
    };

    componentWillUnmount = () => {
        document.removeEventListener("mousedown", this.handleClickOutside);
    };

    handleClickOutside = (event: MouseEvent) => {
        if (
            this.state.expanded &&
            this.containerRef.current &&
            !this.containerRef.current.contains(event.target as Node)
        ) {
            this.setState({ expanded: false });
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

    expandClick = async () => {
        this.setState({ expanded: !this.state.expanded });
    };

    render = () => {
        const loggedIn = this.context?.auth?.isAuthenticated;
        const loading = this.context?.auth?.isLoading;
        if (loading) {
            return <></>;
        }
        const commonButtonEffects =
            "motion-reduce:transition-none hover:outline-3 bg-gray-700 outline-2 outline-white h-10 w-10 rounded-full cursor-pointer transition-all duration-50 ease-in-out flex items-center justify-center";
        return (
            <div
                ref={this.containerRef}
                style={{ ...this.props.style }}
                className={`Login fixed top-3 right-3 z-20 ${this.props.className ?? ""}`}
            >
                {match(loggedIn)
                    .with(true, () => (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-full border-r-2 border-white">
                            <button
                                className={commonButtonEffects}
                                onClick={this.expandClick}
                                title={`Logged in as ${this.context?.auth?.user?.profile?.name || "Anonymous"}`}
                            >
                                <span className="flex font-bold text-white">
                                    {this.context?.auth?.user?.profile?.name
                                        ? this.context?.auth?.user?.profile?.name
                                              .charAt(0)
                                              .toUpperCase()
                                        : "U"}
                                </span>
                            </button>
                            <button
                                title="Logout"
                                onClick={this.logoutClick}
                                className={`${this.state.expanded ? "visible" : "hidden"} p-[10px] hover:bg-red-500 ${commonButtonEffects}`}
                            >
                                <PiSignOutBold color="white" className="h-6 w-6" />
                            </button>
                        </div>
                    ))
                    .with(false, () => (
                        <button
                            className="cursor-pointer rounded-full border-2 border-white p-2 text-white"
                            onClick={this.loginClick}
                            title="Login"
                        >
                            Login
                        </button>
                    ))
                    .with(undefined, () => <></>)
                    .exhaustive()}
            </div>
        );
    };
}
