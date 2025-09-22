import { Component } from "preact";
import Router, { Route } from "preact-router";
import { CSSProperties } from "preact/compat";
import Dev from "./routes/Dev";
import Home from "./routes/Home";

interface AppProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AppState {}

export default class App extends Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div style={{ ...this.props.style }} className={`App ${this.props.className ?? ""}`}>
                <Router>
                    <Route path="/" component={Home} />
                    <Dev path="/dev" />
                </Router>
            </div>
        );
    };
}
