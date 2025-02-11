import "@fontsource-variable/inter";
import { Component } from "preact/compat";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { CustomProvider } from "rsuite";
import { Api } from "./api-client";
import CustomNavbar from "./components/CustomNavbar";
import Dev from "./components/Dev";
import Home from "./components/Home";
import { handleClusterStatusUpdate, handleConfigUpdate, handleMachineStatusUpdate } from "./config";
import "./index.scss";

interface AppProps {}

interface AppState {}

export default class App extends Component<AppProps, AppState> {
    client: Api<unknown>;
    origin: string;

    constructor(props: AppProps) {
        super(props);
        this.origin = "localhost:3000";

        this.client = new Api({ baseUrl: "http://" + this.origin });
    }

    componentDidMount = async () => {
        await handleConfigUpdate(this.origin);
        await handleMachineStatusUpdate(this.origin);
        await handleClusterStatusUpdate(this.origin);
        //setInterval(reloadConfig, 1000);
    };

    render = () => {
        return (
            <div className="App">
                <CustomProvider theme={"dark"}>
                    <BrowserRouter>
                        <div className={"flex"}>
                            <CustomNavbar />
                            <span className="Page w-full p-4 pl-[76px]">
                                <Switch>
                                    <Route exact path="/">
                                        <Home></Home>
                                    </Route>
                                    <Route exact path="/devtools/">
                                        <Dev client={this.client} />
                                    </Route>
                                </Switch>
                            </span>
                        </div>
                    </BrowserRouter>
                </CustomProvider>
            </div>
        );
    };
}
