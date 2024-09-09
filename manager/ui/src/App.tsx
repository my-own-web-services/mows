import "@fontsource-variable/inter";
import { Component } from "preact/compat";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { CustomProvider } from "rsuite";
import { Api } from "./api-client";
import CustomNavbar from "./components/CustomNavbar";
import Dev from "./components/Dev";
import Home from "./components/Home";
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
