import { Api, ManagerConfig } from "./api-client";
import Dev from "./components/Dev";
import { CustomProvider } from "rsuite";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import "rsuite/dist/rsuite.min.css";
import "./index.scss";
import Navbar from "./components/Navbar";
import { signal } from "@preact/signals";
import "@fontsource-variable/inter";
import { Component, PureComponent } from "preact/compat";
import { configSignal, reloadConfig } from "./config";

interface AppProps {}

interface AppState {}

export default class App extends Component<AppProps, AppState> {
    client: Api<unknown>;

    constructor(props: AppProps) {
        super(props);

        this.client = new Api({ baseUrl: "http://localhost:3000" });
    }

    componentDidMount = async () => {
        await reloadConfig();
        //setInterval(this.loadConfig, 1000);
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
                                    <Dev client={this.client} />
                                </Route>
                            </Switch>
                        </span>
                    </BrowserRouter>
                </CustomProvider>
            </div>
        );
    };
}
