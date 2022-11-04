import { Component, h } from "preact";
import Router from "preact-router";

interface AppProps {}
interface AppState {}
export default class App extends Component<AppProps, AppState> {
    render = () => {
        return (
            <div className="App">
                <Router></Router>
            </div>
        );
    };
}
