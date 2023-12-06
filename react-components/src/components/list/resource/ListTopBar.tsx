import { PureComponent, ReactElement, cloneElement, createRef } from "react";
import { AiOutlineSearch } from "react-icons/ai";
import { Button, ButtonGroup, IconButton, Input, InputGroup, Modal, Slider } from "rsuite";
import { BsFillGridFill } from "react-icons/bs";
import { FaThList } from "react-icons/fa";
import ResourceList, { ListType } from "./ResourceList";
import { BiPlus } from "react-icons/bi";
import { IoReload } from "react-icons/io5";

interface ListTopBarProps {
    readonly updateListType: InstanceType<typeof ResourceList>["updateListType"];
    readonly commitSearch: InstanceType<typeof ResourceList>["commitSearch"];
    readonly updateGridColumnCount: InstanceType<typeof ResourceList>["updateGridColumnCount"];
    readonly gridColumnCount: number;
    readonly currentListType: ListType;
    readonly resourceType: string;
    readonly createResource?: ReactElement<any, any>;
    readonly refreshList: () => void;
}

interface ListTopBarState {
    readonly search: string;
    readonly createModalOpen: boolean;
}

export default class ListTopBar extends PureComponent<ListTopBarProps, ListTopBarState> {
    createResourceRef: React.RefObject<any>;

    constructor(props: ListTopBarProps) {
        super(props);
        this.state = {
            search: "",
            createModalOpen: false
        };
        this.createResourceRef = createRef();
    }

    commitSearch = () => {
        this.props.commitSearch(this.state.search);
    };

    changeSearch = (value: string) => {
        this.setState({ search: value });
    };

    searchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            this.commitSearch();
        }
    };

    openModal = () => this.setState({ createModalOpen: true });

    closeModal = () => this.setState({ createModalOpen: false });

    modalCreateResource = async () => {
        const res = await this.createResourceRef.current.create();
        if (res) {
            this.setState({ createModalOpen: false });
            this.props.refreshList();
        }
    };

    setListTypeList = () => this.props.updateListType("List");
    setListTypeGrid = () => this.props.updateListType("Grid");

    render = () => {
        return (
            <div style={{ width: "100%", height: "40px" }} className="ListTopBar">
                <InputGroup size="sm" inside style={{ width: "200px", float: "left" }}>
                    <Input
                        value={this.state.search}
                        onChange={this.changeSearch}
                        onKeyDown={this.searchKeyDown}
                        placeholder={`Search ${this.props.resourceType}s...`}
                    />
                    <InputGroup.Button onClick={this.commitSearch}>
                        <AiOutlineSearch size={21} />
                    </InputGroup.Button>
                </InputGroup>
                {this.props.createResource && (
                    <span className="Buttons">
                        <IconButton
                            onClick={this.openModal}
                            title={`Create new ${this.props.resourceType}`}
                            size="xs"
                            icon={<BiPlus size={18} />}
                        />
                        <Modal onClose={this.closeModal} open={this.state.createModalOpen}>
                            <Modal.Header>
                                <Modal.Title>Create {this.props.resourceType}</Modal.Title>
                            </Modal.Header>
                            <Modal.Body>
                                {cloneElement(this.props.createResource, {
                                    ref: this.createResourceRef
                                })}
                            </Modal.Body>
                            <Modal.Footer>
                                <Button onClick={this.modalCreateResource} appearance="primary">
                                    Create
                                </Button>
                                <Button onClick={this.closeModal} appearance="subtle">
                                    Cancel
                                </Button>
                            </Modal.Footer>
                        </Modal>
                    </span>
                )}
                <span className="Buttons">
                    <IconButton
                        onClick={this.props.refreshList}
                        title={`Reload`}
                        size="xs"
                        icon={<IoReload size={18} />}
                    />
                </span>

                <span className="Buttons">
                    <ButtonGroup size="xs">
                        <IconButton
                            appearance={
                                this.props.currentListType === "List" ? "primary" : "default"
                            }
                            onClick={this.setListTypeList}
                            title="List"
                            icon={<FaThList style={{ transform: "scale(0.9)" }} size={17} />}
                        />
                        <IconButton
                            appearance={
                                this.props.currentListType === "Grid" ? "primary" : "default"
                            }
                            onClick={this.setListTypeGrid}
                            title="Grid"
                            icon={<BsFillGridFill style={{ transform: "scale(0.9)" }} size={17} />}
                        />
                    </ButtonGroup>
                </span>

                {this.props.currentListType === "Grid" && (
                    <>
                        <Slider
                            style={{
                                width: "200px",
                                float: "left",
                                marginTop: "12px",
                                marginLeft: "10px"
                            }}
                            tooltip={false}
                            defaultValue={10}
                            value={this.props.gridColumnCount}
                            min={1}
                            max={30}
                            step={1}
                            onChange={this.props.updateGridColumnCount}
                        />
                        <div style={{ marginLeft: "10px", float: "left", paddingTop: "4px" }}>
                            {this.props.gridColumnCount}
                        </div>
                    </>
                )}
            </div>
        );
    };
}
