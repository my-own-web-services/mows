import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";
import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { Api, ContentType, CreateFileRequestBody } from "../api-client";
import Nav from "../components/Nav";

interface DevProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface DevState {
    readonly user: User | null;
}

export default class Dev extends Component<DevProps, DevState> {
    userManager: UserManager;
    client: Api<unknown>;
    constructor(props: DevProps) {
        super(props);
        this.state = {
            user: null
        };

        this.userManager = new UserManager({
            userStore: new WebStorageStateStore({ store: window.localStorage }),
            authority: "https://zitadel.vindelicorum.eu",
            client_id: "324938566448775334",
            redirect_uri: window.location.origin,
            response_type: "code",
            scope: "openid profile email urn:zitadel:iam:org:project:id:zrc-mows-cloud-filez-filez-auth:aud",
            post_logout_redirect_uri: window.location.origin,
            response_mode: "query"
        });

        this.client = new Api({
            baseUrl: "https://filez-server.vindelicorum.eu",
            baseApiParams: { secure: true },
            securityWorker: async () => ({
                // https://github.com/acacode/swagger-typescript-api/issues/300
                headers: {
                    Authorization: `Bearer ${this.state.user?.access_token ?? ""}`
                }
            })
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

    applyOwnUser = async () => {
        if (this.state.user) {
            const applyUserRes = await this.client.api.applyUser();
        }
    };

    checkAccess = async () => {
        if (this.state.user) {
            const applyUserRes = await this.client.api.applyUser();

            const userId = applyUserRes.data.data?.user_id;

            if (userId) {
                const res = await this.client.api.checkResourceAccess({
                    action: "",
                    resource_ids: [userId],
                    resource_type: "user"
                });
                console.log("API Response:", res);
            }
        }
    };

    createFile = async () => {
        if (this.state.user) {
            const content = new Blob(["This is a test file content"], {
                type: "text/plain"
            });

            const metadata: CreateFileRequestBody = {
                file_name: "test-file.txt",
                mime_type: "text/plain"
            };

            // @ts-ignore
            const res = await this.client.api.createFile(content, {
                headers: {
                    "x-filez-metadata": JSON.stringify(metadata)
                },
                type: ContentType.Binary
            });
            console.log("File created:", res);

            const res2 = await this.client.api
                .getFileContent(res.data.data?.file_id ?? "", null, null)
                .catch((error) => {
                    console.error("Error fetching file:", error);
                });
            if (res2) {
                console.log("File fetched:", res);
            }

            // check why we have access to this file
            const accessCheck = await this.client.api.checkResourceAccess({
                action: "read",
                resource_ids: [res.data.data?.file_id ?? ""],
                resource_type: "file"
            });
            console.log("Access check result:", accessCheck);
        }
    };

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`Dev ${this.props.className ?? ""} h-full w-full`}
            >
                <Nav></Nav>
                {this.state.user ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-5 text-2xl">
                        Welcome back {this.state.user.profile.name}!
                        <button onClick={this.checkAccess}>Check own resource access</button>
                        <button onClick={this.createFile}>Create test file</button>
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
