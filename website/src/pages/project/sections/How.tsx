import { Component } from "preact";
import ManyParts from "./HowManyParts";
import HashNavLink from "../../../components/HashNavLink";

interface HowProps {}
interface HowState {}
export default class How extends Component<HowProps, HowState> {
    render = () => {
        return (
            <section className="How" id="How">
                <HashNavLink className={"How"}>
                    <h1>How?</h1>
                </HashNavLink>
                <ManyParts />
            </section>
        );
    };
}
