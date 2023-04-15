import { Component } from "preact";
import { Input, InputGroup } from "rsuite";
import { IoSearchSharp } from "react-icons/io5";
import "./SearchBox.scss";
import { G } from "../../App";
import { SearchRequest } from "../../utils/filezClient";
interface SearchBoxProps {
    readonly g: G;
}
interface SearchBoxState {
    readonly searchString: string;
}
export default class SearchBox extends Component<SearchBoxProps, SearchBoxState> {
    constructor(props: SearchBoxProps) {
        super(props);
        this.state = {
            searchString: ""
        };
    }

    runSearch = async () => {
        const search: SearchRequest = {
            limit: 100,
            searchType: {
                simpleSearch: {
                    groupId: this.props.g.selectedGroup?.fileGroup?._id ?? "",
                    query: this.state.searchString
                }
            }
        };

        const res = await this.props.g.filezClient.search(search);
        this.props.g.fn.displaySearchResults(res);
    };

    render = () => {
        return (
            <div className="SearchBox">
                <InputGroup style={{ width: "400px" }} size="sm">
                    <Input
                        placeholder="Search"
                        style={{ width: "100px" }}
                        onChange={value => {
                            this.setState({ searchString: value });
                        }}
                        value={this.state.searchString}
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
