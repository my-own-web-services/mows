import { Component } from "preact";
import "./Center.scss";
import SelectView from "./components/selectView/SelectView";

interface CenterProps {}
interface CenterState {}
export default class Center extends Component<CenterProps, CenterState> {
    render = () => {
        return (
            <div id="main-panel-center" className="horizontal-panel panel">
                <SelectView></SelectView>
            </div>
        );
    };
}
