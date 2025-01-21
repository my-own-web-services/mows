// @ts-ignore
import "@fontsource-variable/inter";
import { isEqual } from "lodash";
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
    readonly renderResult?: Record<string, string>;
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

    renderRepo = async (id: number) => {
        const res = await this.client.api.renderRepositories({
            repositories: [
                {
                    repository_selector: {
                        Id: id
                    },
                    namespace: "test",
                    target: {
                        RenderOnly: {}
                    }
                }
            ]
        });
        this.setState({ renderResult: res.data.data?.results[0] });
    };

    shouldComponentUpdate = (nextProps: AppProps, nextState: AppState) => {
        return (
            this.state.repoUrl !== nextState.repoUrl ||
            this.state.repositories !== nextState.repositories ||
            !isEqual(this.state.renderResult, nextState.renderResult)
        );
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
                                    repositories: [{ uri: this.state.repoUrl }]
                                });
                            }
                        }}
                    >
                        Add
                    </Button>
                    <div>
                        {this.state.repositories?.map((repo) => (
                            <div key={repo.id}>
                                {repo.uri}
                                <Button onClick={() => this.renderRepo(repo.id)}>Render</Button>
                            </div>
                        ))}
                    </div>
                    <div className={"flex flex-col gap-10"}>
                        {this.state.renderResult &&
                            Object.entries(this.state.renderResult).map(([key, value]) => (
                                <div key={key} className={"p-4"}>
                                    <h3 className={"text-lg font-bold"}>{key}</h3>
                                    <pre className={"rounded-lg bg-nightSky10 p-4"}>{value}</pre>
                                </div>
                            ))}
                    </div>
                </CustomProvider>
            </div>
        );
    };
}
