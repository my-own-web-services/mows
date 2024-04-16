import { Component } from "preact";
import HashNavLink from "../../../../components/HashNavLink";
import ArchitectureProblems from "./ArchitectureProblems";

interface WhyProblemsProps {}
interface WhyProblemsState {}
export default class WhyProblems extends Component<WhyProblemsProps, WhyProblemsState> {
    render = () => {
        return (
            <section id="WhyProblems" className={"WhyProblems"}>
                <HashNavLink className={"WhyProblems"}>
                    <h1>Problems With Current Architectures</h1>
                </HashNavLink>

                <ArchitectureProblems />
            </section>
        );
    };
}
