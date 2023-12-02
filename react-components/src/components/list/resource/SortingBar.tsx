import { Component, createRef } from "react";
import Split from "react-split";
import ResourceList, { Column, ColumnDirection } from "./ResourceList";
import { Item, Menu, useContextMenu } from "react-contexify";
import { BiCheck, BiChevronDown, BiChevronUp } from "react-icons/bi";
import { Checkbox, Input, InputGroup } from "rsuite";
import { Icon } from "@rsuite/icons";
import { FaPlus } from "react-icons/fa6";

export const dragHandleWidth = 10;

interface SortingBarProps<ResourceType> {
    readonly updateSortingColumnWidths: InstanceType<
        typeof ResourceList
    >["updateSortingColumnWidths"];
    readonly updateColumnDirections: InstanceType<typeof ResourceList>["updateColumnDirections"];
    readonly updateColumnVisibility: InstanceType<typeof ResourceList>["updateColumnVisibility"];
    readonly createColumn: InstanceType<typeof ResourceList>["createColumn"];
    readonly columns: Column<ResourceType>[];
    readonly resourceListId: string;
}

interface SortingBarState<ResourceType> {
    readonly show: boolean;
    readonly field: string;
}

export default class SortingBar<ResourceType> extends Component<
    SortingBarProps<ResourceType>,
    SortingBarState<ResourceType>
> {
    splitRef = createRef<Split>();

    constructor(props: SortingBarProps<ResourceType>) {
        super(props);
        this.state = {
            show: true,
            field: ""
        };
    }

    getId = () => {
        return this.props.resourceListId + "-sorting-bar";
    };

    componentDidUpdate(
        prevProps: Readonly<SortingBarProps<ResourceType>>,
        prevState: Readonly<SortingBarState<ResourceType>>,
        snapshot?: any
    ): void {
        if (
            prevProps.columns.filter(c => c.visible).length !==
            this.props.columns.filter(c => c.visible).length
        ) {
            this.setState({ show: false }, () => {
                setTimeout(() => {
                    this.setState({ show: true });
                }, 0);
            });
        }
    }

    render = () => {
        const { show } = useContextMenu({
            id: this.getId()
        });

        const activeColumns = this.props.columns.filter(c => c.visible);

        const styles = {
            border: "1px solid var(--gutters)",
            height: "20px",
            width: "100%"
        };

        return (
            <div
                className="SortingBar"
                onContextMenu={e => {
                    e.preventDefault();
                    show({ event: e });
                }}
            >
                {this.state.show && activeColumns.length ? (
                    <Split
                        ref={this.splitRef}
                        gutterSize={dragHandleWidth}
                        className="Columns"
                        style={{
                            ...styles,
                            verticalAlign: "top",
                            display: "flex"
                        }}
                        sizes={activeColumns.map(column => column.widthPercent)}
                        minSize={activeColumns.map(column => column.minWidthPixels)}
                        direction="horizontal"
                        cursor="col-resize"
                        onDrag={this.props.updateSortingColumnWidths}
                    >
                        {activeColumns.map((column, index) => {
                            return (
                                <button
                                    className="Filez"
                                    key={column.field}
                                    style={{
                                        background: "none",
                                        fontSize: "100%",
                                        color: "#fff",
                                        padding: "0",
                                        margin: "0",
                                        height: "100%",
                                        paddingLeft: "5px"
                                    }}
                                    onClick={() => this.props.updateColumnDirections(column.field)}
                                >
                                    <div style={{ float: "left" }}>{column.field}</div>
                                    <span>
                                        {(() => {
                                            const chevronStyle = {
                                                marginTop: "2px",
                                                display: "block",
                                                float: "left"
                                            };
                                            const chevronSize = 16;
                                            if (column.direction === ColumnDirection.ASCENDING) {
                                                return (
                                                    <BiChevronDown
                                                        size={chevronSize}
                                                        style={chevronStyle}
                                                    />
                                                );
                                            }
                                            if (column.direction === ColumnDirection.DESCENDING) {
                                                return (
                                                    <BiChevronUp
                                                        size={chevronSize}
                                                        style={chevronStyle}
                                                    />
                                                );
                                            }
                                        })()}
                                    </span>
                                </button>
                            );
                        })}
                    </Split>
                ) : (
                    <div style={styles}></div>
                )}
                <Menu id={this.getId()}>
                    {this.props.columns.map((column, index) => {
                        return (
                            <Item
                                key={this.props.resourceListId + column.field + "-menu-item"}
                                onClick={() => {
                                    this.props.updateColumnVisibility(
                                        column.field,
                                        !column.visible
                                    );
                                }}
                                closeOnClick={false}
                            >
                                <Checkbox checked={column.visible} />

                                <span>{column.field}</span>
                            </Item>
                        );
                    })}
                    <Item closeOnClick={false}>
                        <InputGroup>
                            {/* TODO: add input auto completion, show all fields (even nested) that are on file object as options*/}
                            <Input
                                value={this.state.field}
                                placeholder="Add column"
                                onChange={value => {
                                    this.setState({ field: value });
                                }}
                                //when enter is pressed
                                onPressEnter={() => {
                                    this.props.createColumn(this.state.field);
                                    this.setState({ field: "" });
                                }}
                            />{" "}
                            <InputGroup.Button
                                onClick={() => {
                                    this.props.createColumn(this.state.field);
                                    this.setState({ field: "" });
                                }}
                            >
                                <Icon style={{ cursor: "pointer" }} as={FaPlus} />
                            </InputGroup.Button>
                        </InputGroup>
                    </Item>
                </Menu>
            </div>
        );
    };
}

/*
 <button
    style={{
        height: "100%",
        width: "35px",
        float: "right",
        position: "absolute",
        right: "0px"
    }}
    className="Filez AddColumn"
    title="Add column"
>
    <RiInsertColumnRight size={25} color={"#fff"} style={{ height: "100%" }} />
</button>

*/
