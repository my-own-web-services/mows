import { Component } from "preact";
import { CSSProperties } from "preact/compat";

interface AppProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AppState {}

export default class App extends Component<AppProps, AppState>{
    constructor(props: AppProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return <div style={{...this.props.style}} className={`App ${this.props.className??""}`}></div>;
    };
}