import { Component } from "preact";
import HashNavLink from "../../../../components/HashNavLink";
import ArchitectureProblems from "./ArchitectureProblems";

interface WhyProblemsProps {}
interface WhyProblemsState {}
export default class WhyProblems extends Component<WhyProblemsProps, WhyProblemsState> {
    render = () => {
        return (
            <section id="WhyProblems">
                <HashNavLink className={"WhyProblems"}>
                    <h2>Problems With Current Architectures</h2>
                </HashNavLink>

                <ArchitectureProblems />
            </section>
        );
    };
}
