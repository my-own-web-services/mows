import { Component } from "preact";
import SearchBox from "./SearchBox";
import "./Filter.scss";
import { G } from "../../App";
interface FilterProps {
    readonly g: G;
}
interface FilterState {}
export default class Filter extends Component<FilterProps, FilterState> {
    render = () => {
        return (
            <div className="Filter">
                <SearchBox g={this.props.g}></SearchBox>
            </div>
        );
    };
}
