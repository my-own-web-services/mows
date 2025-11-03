import { PrimaryMenu } from "filez-components-react";
import { Component, CSSProperties } from "preact";
import Router, { Route } from "preact-router";
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
                <PrimaryMenu />
                <Router>
                    <Route path="/" component={Home} />
                </Router>
            </div>
        );
    };
}
