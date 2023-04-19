import { Component } from "preact";
import { Input, InputGroup } from "rsuite";
import { IoClose, IoSearchSharp } from "react-icons/io5";
import "./SearchBox.scss";
import { G } from "../../App";
import { SearchRequest } from "../../utils/filezClient";
interface SearchBoxProps {
    readonly g: G;
    readonly search: string;
}
interface SearchBoxState {}
export default class SearchBox extends Component<SearchBoxProps, SearchBoxState> {
    constructor(props: SearchBoxProps) {
        super(props);
    }

    render = () => {
        return (
            <div className="SearchBox">
                <InputGroup style={{ width: "400px" }} size="sm">
                    <Input
                        placeholder="Search"
                        style={{ width: "100px" }}
                        onChange={value => {
                            this.props.g.fn.setSearch(value);
                        }}
                        value={this.props.search}
                        onPressEnter={this.props.g.fn.commitSearch}
                    />
                    <InputGroup.Button onClick={() => this.props.g.fn.setSearch("")}>
                        <IoClose></IoClose>
                    </InputGroup.Button>
                    <InputGroup.Button onClick={this.props.g.fn.commitSearch}>
                        <IoSearchSharp></IoSearchSharp>
                    </InputGroup.Button>
                </InputGroup>
            </div>
        );
    };
}
