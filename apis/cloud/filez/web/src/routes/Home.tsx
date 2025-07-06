import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import Nav from "../components/Nav";

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
                <Nav></Nav>
            </div>
        );
    };
}
