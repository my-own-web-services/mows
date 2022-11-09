import { Component } from "preact";
import "./Single.scss";

interface SingleProps {}
interface SingleState {}
export default class Single extends Component<SingleProps, SingleState> {
    render = () => {
        return <div className="Single"></div>;
    };
}
