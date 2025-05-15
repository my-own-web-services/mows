import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";
import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import Nav from "../components/Nav";

interface HomeProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface HomeState {
    readonly user: User | null;
}

export default class Home extends Component<HomeProps, HomeState> {
    userManager: UserManager;
    constructor(props: HomeProps) {
        super(props);
        this.state = {
            user: null
        };

        this.userManager = new UserManager({
            userStore: new WebStorageStateStore({ store: window.localStorage }),
            authority: "https://zitadel.vindelicorum.eu",
            client_id: "320164741488116389",
            redirect_uri: "http://localhost:5174",
            response_type: "code",
            scope: "openid profile email urn:zitadel:iam:org:project:id:zrc-mows-cloud-filez-filez-auth:aud",
            post_logout_redirect_uri: "http://localhost:5174",
            response_mode: "query"
        });
    }

    componentDidMount = async () => {
        this.userManager.getUser().then((user) => {
            if (user) {
                this.setState({ user });
            } else {
                this.setState({ user: null });
            }
        });

        if (window.location.href.includes("id_token") || window.location.href.includes("code")) {
            this.userManager.signinRedirectCallback().then((user) => {
                if (user) {
                    this.setState({ user });
                } else {
                    this.setState({ user: null });
                }
            });
        }
    };

    handleLogin = () => {
        this.userManager.signinRedirect({});
    };

    handleLogout = () => {
        this.userManager.removeUser();
        this.setState({ user: null });
    };

    sendApiRequest = () => {
        if (this.state.user) {
            fetch("https://filez-server.vindelicorum.eu/get", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.state.user.access_token}`
                }
            })
                .then((response) => response.json())
                .then((data) => {
                    console.log(data);
                });
        }
    };

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`Home ${this.props.className ?? ""} h-full w-full`}
            >
                <Nav></Nav>
                {this.state.user ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-5 text-2xl">
                        Welcome back {this.state.user.profile.name}!
                        <button onClick={this.sendApiRequest}>Send API Request </button>
                        <button onClick={this.handleLogout}>Logout</button>
                    </div>
                ) : (
                    <button
                        onClick={this.handleLogin}
                        className="flex h-full w-full items-center justify-center text-2xl"
                    >
                        Login
                    </button>
                )}
            </div>
        );
    };
}

/*


                  

*/
