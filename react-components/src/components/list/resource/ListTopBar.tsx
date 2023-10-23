import { PureComponent, ReactElement, cloneElement, createRef } from "react";
import { AiOutlineSearch } from "react-icons/ai";
import { Button, ButtonGroup, IconButton, Input, InputGroup, Modal, Slider } from "rsuite";
import { BsFillGridFill } from "react-icons/bs";
import { FaThList } from "react-icons/fa";
import ResourceList, { ListType } from "./ResourceList";
import { BiPlus } from "react-icons/bi";

interface ListTopBarProps {
    readonly updateListType: InstanceType<typeof ResourceList>["updateListType"];
    readonly commitSearch: InstanceType<typeof ResourceList>["commitSearch"];
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
    createResourceRef: any;

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
                {this.props.createResource && (
                    <span className="Buttons">
                        <IconButton
                            onClick={() => {
                                this.setState({ createModalOpen: true });
                            }}
                            title={`Create new ${this.props.resourceType}`}
                            size="xs"
                            icon={<BiPlus size={18} />}
                        />
                        <Modal
                            onClose={() => {
                                this.setState({ createModalOpen: false });
                            }}
                            open={this.state.createModalOpen}
                        >
                            <Modal.Header>
                                <Modal.Title>Create {this.props.resourceType}</Modal.Title>
                            </Modal.Header>
                            <Modal.Body>
                                {cloneElement(this.props.createResource, {
                                    ref: this.createResourceRef
                                })}
                            </Modal.Body>
                            <Modal.Footer>
                                <Button
                                    onClick={async () => {
                                        const res = await this.createResourceRef.current.create();
                                        if (res) {
                                            this.setState({ createModalOpen: false });
                                            this.props.refreshList();
                                        }
                                    }}
                                    appearance="primary"
                                >
                                    Create
                                </Button>
                                <Button
                                    onClick={() => {
                                        this.setState({ createModalOpen: false });
                                    }}
                                    appearance="subtle"
                                >
                                    Cancel
                                </Button>
                            </Modal.Footer>
                        </Modal>
                    </span>
                )}

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
                    />
                )}
            </div>
        );
    };
}
