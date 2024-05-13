import { Component } from "preact";
import HashNavLink from "../../../../components/HashNavLink";
import ArchitectureProblems from "./components/ArchitectureProblems";
import { CSSProperties } from "react";

interface ProblemsProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly id?: string;
}
interface ProblemsState {}
export default class Problems extends Component<ProblemsProps, ProblemsState> {
    render = () => {
        return (
            <section id={this.props.id} className={`Problems ${this.props.className ?? ""}`}>
                <HashNavLink className={this.props.id}>
                    <h1>Problems With Current Architectures</h1>
                </HashNavLink>

                <ArchitectureProblems />
            </section>
        );
    };
}
