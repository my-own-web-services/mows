import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import HashNavLink from "../../../../components/HashNavLink";
import WorkInProgress from "./WorkInProgress";

interface ContributeProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface ContributeState {}

export default class Contribute extends Component<ContributeProps, ContributeState> {
    constructor(props: ContributeProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <section
                style={{ ...this.props.style }}
                className={`Contribute ${this.props.className ?? ""}`}
            >
                <HashNavLink className={"Contribute"}>
                    <h1>Contribute</h1>
                </HashNavLink>
                <WorkInProgress className="w-full" />
            </section>
        );
    };
}
