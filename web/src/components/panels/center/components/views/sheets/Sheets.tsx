import { Component } from "preact";
import { G } from "../../../../../../App";
import { FilezFile } from "../../../../../../types";
import "./Sheets.scss";
interface SheetsProps {
    readonly g: G;
}
interface SheetsState {}
export default class Sheets extends Component<SheetsProps, SheetsState> {
    render = () => {
        return <div className="Sheets">Sheets</div>;
    };
}
