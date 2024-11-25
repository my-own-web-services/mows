// @ts-ignore
import "@fontsource-variable/inter";
import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { Button, CustomProvider, Input } from "rsuite";
import { Api, Repository } from "./api-client";
import "./index.scss";

interface AppProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AppState {
    readonly repoUrl?: string;
    readonly repositories?: Repository[];
}

export default class App extends Component<AppProps, AppState> {
    client: Api<unknown>;
    constructor(props: AppProps) {
        super(props);
        this.state = {};

        this.client = new Api({ baseUrl: "http://localhost:3003" });
    }

    componentDidMount = async () => {
        const res = (await this.client.api.getRepositories()).data;

        this.setState({ repositories: res.data?.repositories });
    };

    render = () => {
        return (
            <div style={{ ...this.props.style }} className={`App ${this.props.className ?? ""}`}>
                <CustomProvider theme={"dark"}>
                    <h1>Repository</h1>
                    <Input
                        onChange={(value) => {
                            this.setState({ repoUrl: value });
                        }}
                        placeholder="Repo Url"
                    />
                    <Button
                        onClick={async () => {
                            if (this.state.repoUrl) {
                                const response = await this.client.api.addRepositories({
                                    repositories: [{ url: this.state.repoUrl }]
                                });
                            }
                        }}
                    >
                        Add
                    </Button>
                    <div>
                        {this.state.repositories?.map((repo) => (
                            <div key={repo.id}>{repo.url}</div>
                        ))}
                    </div>
                </CustomProvider>
            </div>
        );
    };
}
