import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { AuthContextProps, withAuth } from "react-oidc-context";

interface AuthProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly auth?: AuthContextProps;
}

interface AuthState {}

class Auth extends Component<AuthProps, AuthState> {
    constructor(props: AuthProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    componentDidUpdate = async () => {
        if (window.location.pathname === "/auth/callback" && this.props.auth?.user) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            // get the redirect_uri from local storage
            const redirect_uri = localStorage.getItem("redirect_uri");
            if (redirect_uri) {
                localStorage.removeItem("redirect_uri");
                window.location.href = redirect_uri;
            }
        }
    };

    signOut = async () => {
        await this.props.auth?.removeUser();
    };

    signIn = async () => {
        // get the redirect_uri from the query param
        const redirect_uri = new URLSearchParams(window.location.search).get("redirect_uri");
        // set the redirect_uri to local storage
        if (redirect_uri) {
            localStorage.setItem("redirect_uri", redirect_uri);
        }

        this.props.auth?.signinRedirect();
    };

    render = () => {
        return (
            <div style={{ ...this.props.style }} className={`Auth ${this.props.className ?? ""}`}>
                <div className="flex h-[100vh] flex-col items-center justify-center overflow-hidden">
                    {this.props.auth?.user && (
                        <div>
                            <h1 className="mb-4 text-3xl font-bold">
                                Welcome, {this.props.auth.user.profile.name}!
                            </h1>
                        </div>
                    )}
                </div>
            </div>
        );
    };
}

export default withAuth(Auth);
