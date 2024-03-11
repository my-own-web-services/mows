import { PureComponent } from "react";
import { Api } from "./api-client";
import Dev from "./components/Dev";
import { CustomProvider } from "rsuite";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import "rsuite/dist/rsuite.min.css";
import "./index.scss";
import Navbar from "./components/Navbar";

interface AppProps {}

interface AppState {
    config: string;
}

export default class App extends PureComponent<AppProps, AppState> {
    client: Api<unknown>;

    constructor(props: AppProps) {
        super(props);
        this.state = {
            config: ""
        };
        this.client = new Api({ baseUrl: "http://localhost:3000" });
    }

    componentDidMount = async () => {
        await this.loadConfig();
    };

    updateConfig = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        this.setState({ config: e.target.value });
    };

    loadConfig = async () => {
        const config = (await this.client.api.getConfig()).data;
        this.setState({ config: JSON.stringify(config) });
    };

    render = () => {
        return (
            <div className="App">
                <CustomProvider theme={"dark"}>
                    <BrowserRouter>
                        <Navbar />
                        <span className="Page">
                            <Switch>
                                <Route path="/dev/">
                                    <Dev
                                        client={this.client}
                                        config={this.state.config}
                                        loadConfig={this.loadConfig}
                                        updateConfig={this.updateConfig}
                                    ></Dev>
                                </Route>
                            </Switch>
                        </span>
                    </BrowserRouter>
                </CustomProvider>
            </div>
        );
    };
}
