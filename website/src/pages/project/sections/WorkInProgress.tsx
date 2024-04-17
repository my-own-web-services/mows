import { Component } from "preact";
import HashNavLink from "../../../components/HashNavLink";

interface WorkInProgressProps {
    readonly style?: React.CSSProperties;
}
interface WorkInProgressState {}
export default class WorkInProgress extends Component<WorkInProgressProps, WorkInProgressState> {
    render = () => {
        return (
            <div className={"subsection"} style={this.props.style}>
                <div>
                    <HashNavLink className={"WorkInProgress"}>
                        <h3>Work in progress 🏗️</h3>
                    </HashNavLink>

                    <p className={"largeText"}>
                        MOWS is currently in the early stages of development. Many problems have a
                        conceptualized solution, but the implementation is still pending. If you are
                        interested in contributing or donating to help us make this vision reality,
                        please don't hesitate to <a href="mailto:mows@vindelicum.eu">contact us</a>.
                        Sharing the project, giving feedback, asking a{" "}
                        <a
                            rel="noreferrer noopener"
                            href="https://github.com/my-own-web-services/mows/discussions"
                        >
                            question
                        </a>{" "}
                        and dropping a star on{" "}
                        <a
                            rel="noreferrer noopener"
                            href="https://github.com/my-own-web-services/mows"
                        >
                            GitHub
                        </a>
                        , to show your interest and pushing our motivation, is also highly
                        appreciated.
                    </p>
                </div>
            </div>
        );
    };
}
