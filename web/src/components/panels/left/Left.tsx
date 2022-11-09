import { Component } from "preact";
import "./Left.scss";

interface LeftProps {}
interface LeftState {}
export default class Left extends Component<LeftProps, LeftState> {
    render = () => {
        return <div className="Left"></div>;
    };
}
