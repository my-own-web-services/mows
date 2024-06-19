import "@fontsource-variable/inter";
import { Component } from "preact/compat";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { CustomProvider } from "rsuite";
import "rsuite/dist/rsuite.min.css";
import { Api } from "./api-client";
import Dev from "./components/Dev";
import Navbar from "./components/Navbar";
import { handleConfigUpdate, handleMachineStatusUpdate } from "./config";
import "./index.scss";

interface AppProps {}

interface AppState {}

export default class App extends Component<AppProps, AppState> {
    client: Api<unknown>;

    constructor(props: AppProps) {
        super(props);

        this.client = new Api({ baseUrl: "http://localhost:3000" });
    }

    componentDidMount = async () => {
        await handleConfigUpdate();
        await handleMachineStatusUpdate();
        //setInterval(reloadConfig, 1000);
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
