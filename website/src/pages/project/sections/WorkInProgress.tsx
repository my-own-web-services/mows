import { Component } from "preact";
import HashNavLink from "../../../components/HashNavLink";
import Progress from "./Progress";

interface WorkInProgressProps {}
interface WorkInProgressState {}
export default class WorkInProgress extends Component<WorkInProgressProps, WorkInProgressState> {
    render = () => {
        return (
            <div className={"subsection"}>
                <div>
                    <HashNavLink className={"MOWSWIP"}>
                        <h2>Work in progress 🏗️</h2>
                    </HashNavLink>
                    <p className={"largeText"}>
                        MOWS is currently in the early stages of development. Layed out below is the
                        vision of what MOWS will be. Many problems have a conceptualized solution,
                        but the implementation is still pending. If you are interested in
                        contributing or donating to help us make this vision reality, please don't
                        hesitate to <a href="mailto:mows@vindelicum.eu">contact us</a>. Sharing the
                        project, giving feedback, asking a{" "}
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
                <Progress />
            </div>
        );
    };
}
