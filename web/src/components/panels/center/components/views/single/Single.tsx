import { Component } from "preact";
import { G } from "../../../../../../App";
import "./Single.scss";

interface SingleProps {
    readonly g: G;
}
interface SingleState {}
export default class Single extends Component<SingleProps, SingleState> {
    render = () => {
        return <div className="Single">Single</div>;
    };
}
