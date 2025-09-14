import { CSSProperties, PureComponent } from "react";
import Login from "../lib/components/Login";

interface AppProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AppState {}

export default class App extends PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`App h-full w-full bg-gray-900 ${this.props.className ?? ""}`}
            >
                <Login></Login>
            </div>
        );
    };
}
