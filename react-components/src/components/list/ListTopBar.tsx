import { PureComponent } from "react";
import { AiOutlineSearch } from "react-icons/ai";
import { ButtonGroup, IconButton, Input, InputGroup, Slider } from "rsuite";
import { BsFillGridFill } from "react-icons/bs";
import { FaThList } from "react-icons/fa";
import ResourceList, { ListType } from "./ResourceList";

interface ListTopBarProps {
    readonly updateListType: InstanceType<typeof ResourceList>["updateListType"];
    readonly commitSearch: InstanceType<typeof ResourceList>["commitSearch"];
    readonly currentListType: ListType;
}

interface ListTopBarState {
    readonly search: string;
}

export default class ListTopBar extends PureComponent<ListTopBarProps, ListTopBarState> {
    constructor(props: ListTopBarProps) {
        super(props);
        this.state = {
            search: ""
        };
    }

    commitSearch = () => {
        this.props.commitSearch(this.state.search);
    };

    render = () => {
        return (
            <div style={{ width: "100%", height: "40px" }} className="ListTopBar">
                <InputGroup size="sm" inside style={{ width: "200px", float: "left" }}>
                    <Input
                        value={this.state.search}
                        onChange={value => {
                            this.setState({ search: value });
                        }}
                        onKeyDown={event => {
                            if (event.key === "Enter") {
                                this.commitSearch();
                            }
                        }}
                        placeholder="Search..."
                    />
                    <InputGroup.Button
                        onClick={() => {
                            this.commitSearch();
                        }}
                    >
                        <AiOutlineSearch size={21} />
                    </InputGroup.Button>
                </InputGroup>
                <span className="Buttons">
                    <ButtonGroup size="xs">
                        <IconButton
                            appearance={
                                this.props.currentListType === ListType.List ? "primary" : "default"
                            }
                            onClick={() => {
                                this.props.updateListType(ListType.List);
                            }}
                            title="List"
                            icon={<FaThList style={{ transform: "scale(0.9)" }} size={17} />}
                        />
                        <IconButton
                            appearance={
                                this.props.currentListType === ListType.Grid ? "primary" : "default"
                            }
                            onClick={() => {
                                this.props.updateListType(ListType.Grid);
                            }}
                            title="Grid"
                            icon={<BsFillGridFill style={{ transform: "scale(0.9)" }} size={17} />}
                        />
                    </ButtonGroup>
                </span>
                {this.props.currentListType === ListType.Grid && (
                    <Slider
                        style={{
                            width: "200px",
                            float: "right",
                            marginTop: "10px",
                            marginRight: "10px"
                        }}
                        defaultValue={0}
                        min={0}
                        max={100}
                        step={1}
                    ></Slider>
                )}
            </div>
        );
    };
}
