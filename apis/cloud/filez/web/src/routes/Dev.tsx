import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { Api } from "../api-client";
import { runTests } from "../apiTests/mod";
import Nav from "../components/Nav";

interface DevProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly filezClient: Api<unknown> | null;
}

interface DevState {}

export default class Dev extends Component<DevProps, DevState> {
    constructor(props: DevProps) {
        super(props);
        this.state = {
            user: null
        };
    }

    runTestSuite = async () => {
        if (!this.props.filezClient) {
            console.error("Filez client is not initialized.");
            return;
        }
        await runTests(this.props.filezClient);
    };

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`Dev ${this.props.className ?? ""} h-full w-full`}
            >
                <Nav></Nav>
                <button onClick={this.runTestSuite} className={""}>
                    Run test suite
                </button>
            </div>
        );
    };
}
