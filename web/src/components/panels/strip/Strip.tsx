import { Component } from "preact";
import "./Strip.scss";
interface StripProps {}
interface StripState {}
export default class Strip extends Component<StripProps, StripState> {
    render = () => {
        return <div id="file-strip-panel" className="vertical-panel panel"></div>;
    };
}
