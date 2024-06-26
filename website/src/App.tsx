import "@fontsource-variable/inter";
import { Component } from "preact";
import NavBar from "./components/Nav";
import { BrowserRouter, Route } from "react-router-dom";
import "./index.scss";
import Project from "./pages/Project";
import FailureCalculator from "./components/FailureCalculator";

interface AppProps {}
interface AppState {}
export default class App extends Component<AppProps, AppState> {
    componentDidMount = async () => {};

    comingSoon = () => {
        return (
            <div className={"text-center"}>
                <h1>Coming Soon!</h1>
            </div>
        );
    };

    render = () => {
        return (
            <div className="App">
                <BrowserRouter>
                    <NavBar />
                    <Route path="/" exact component={Project} />
                    <Route path="/install" component={this.comingSoon} />
                    <Route path="/apps" component={this.comingSoon} />
                    <Route path="/hardware" component={this.comingSoon} />
                    <Route path="/dev/manager" component={this.comingSoon} />
                    <Route path="/dev/operator" component={this.comingSoon} />
                    <Route path="/dev/apis" component={this.comingSoon} />
                    <Route path="/dev/hardware" component={this.comingSoon} />
                </BrowserRouter>
                <footer className={"w-full flex justify-center gap-24 p-24 lg:p-10"}>
                    <a href="https://vindelicum.eu/impressum/">Legal Notice</a>
                    <a href="https://vindelicum.eu/datenschutz/">Privacy</a>
                </footer>
            </div>
        );
    };
}
