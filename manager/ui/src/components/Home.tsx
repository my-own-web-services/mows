import { Component } from "preact";
import { CSSProperties } from "preact/compat";

interface HomeProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface HomeState {}

export default class Home extends Component<HomeProps, HomeState> {
    constructor(props: HomeProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div style={{ ...this.props.style }} className={`Home ${this.props.className ?? ""}`}>
                <h1 className={"text-3xl font-bold"}>Welcome to the MOWS Manager</h1>
            </div>
        );
    };
}
