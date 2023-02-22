import { Component } from "preact";
import { Input, InputGroup } from "rsuite";
import { IoSearchSharp } from "react-icons/io5";
import "./SearchBox.scss";
import { G } from "../../App";
interface SearchBoxProps {
    readonly g: G;
}
interface SearchBoxState {
    readonly search: string;
}
export default class SearchBox extends Component<SearchBoxProps, SearchBoxState> {
    runSearch = () => {};

    render = () => {
        return (
            <div className="SearchBox">
                <InputGroup style={{ width: "400px" }} size="sm">
                    <Input
                        placeholder="Search"
                        style={{ width: "100px" }}
                        onChange={value => {
                            this.setState({ search: value });
                        }}
                        value={this.state.search}
                        onPressEnter={this.runSearch}
                    />
                    <InputGroup.Button onClick={this.runSearch}>
                        <IoSearchSharp></IoSearchSharp>
                    </InputGroup.Button>
                </InputGroup>
            </div>
        );
    };
}
