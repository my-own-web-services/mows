import "@fontsource-variable/inter";
import { Component } from "preact";
import NavBar from "./components/Navbar";
import { BrowserRouter, Route } from "react-router-dom";
import "./index.scss";
import Project from "./pages/Project";

interface AppProps {}
interface AppState {}
export default class App extends Component<AppProps, AppState> {
    componentDidMount = async () => {};

    render = () => {
        return (
            <div className="App">
                <BrowserRouter>
                    <NavBar />
                    <Route path="/" exact component={Project} />
                    <Route path="/install" component={Project} />
                    <Route path="/apps" component={Project} />
                    <Route path="/hardware" component={Project} />
                    <Route path="/dev/manager" component={Project} />
                    <Route path="/dev/operator" component={Project} />
                    <Route path="/dev/apis" component={Project} />
                    <Route path="/dev/hardware" component={Project} />
                </BrowserRouter>
            </div>
        );
    };
}
