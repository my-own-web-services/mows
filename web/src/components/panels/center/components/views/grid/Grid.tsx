import { Component } from "preact";
import "./Grid.scss";
interface GridProps {}
interface GridState {}
export default class Grid extends Component<GridProps, GridState> {
    render = () => {
        return <div className="Grid"></div>;
    };
}
