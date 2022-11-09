import { Component } from "preact";
import "./Center.scss";

interface CenterProps {}
interface CenterState {}
export default class Center extends Component<CenterProps, CenterState> {
    render = () => {
        return <div className="Center"></div>;
    };
}
