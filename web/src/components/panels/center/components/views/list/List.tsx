import { Component } from "preact";
import "./List.scss";

interface ListProps {}
interface ListState {}
export default class List extends Component<ListProps, ListState> {
    render = () => {
        return <div className="List">List</div>;
    };
}
