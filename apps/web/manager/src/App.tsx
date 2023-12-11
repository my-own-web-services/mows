import { PureComponent } from "react";

interface AppProps {}

interface AppState {}

export default class App extends PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return <div className="App"></div>;
    };
}
