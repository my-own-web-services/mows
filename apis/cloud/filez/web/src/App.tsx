import { Component } from "preact";
import { Route, Router } from "preact-router";
import { CSSProperties } from "preact/compat";
import { AuthState, withAuth } from "react-oidc-context";
import { Api } from "./api-client";
import Auth from "./routes/Auth";
import Dev from "./routes/Dev";
import Home from "./routes/Home";

interface AppProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly auth?: AuthState;
}

interface AppState {}
class App extends Component<AppProps, AppState> {
    filezClient: Api<unknown> | null = null;
    constructor(props: AppProps) {
        super(props);
        this.state = {
            user: null
        };
    }

    componentDidMount = () => {};

    componentDidUpdate = async (
        previousProps: Readonly<AppProps>,
        previousState: Readonly<AppState>,
        snapshot: any
    ) => {
        if (!this.filezClient && this.props.auth?.user) {
            this.filezClient = new Api({
                baseUrl: "https://filez-server.vindelicorum.eu",
                baseApiParams: { secure: true },
                securityWorker: async () => ({
                    // https://github.com/acacode/swagger-typescript-api/issues/300
                    headers: {
                        Authorization: `Bearer ${this.props.auth?.user?.access_token ?? ""}`
                    }
                })
            });
            console.log("Api client initialized with user token");
            await this.filezClient.api.applyUser();
        }
    };

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`App ${this.props.className ?? ""} min-h-full w-full bg-zinc-950`}
            >
                <Router>
                    <Route path="/" component={Home} />
                    <Dev path="/dev" filezClient={this.filezClient} />
                    <Auth path="/auth/:remaining_path*" />
                </Router>
            </div>
        );
    };
}

export default withAuth(App);
