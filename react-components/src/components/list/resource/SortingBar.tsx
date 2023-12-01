import { Component, PureComponent } from "react";
import Split from "react-split";
import ResourceList, { Column, ColumnDirection } from "./ResourceList";
import { Item, Menu, useContextMenu } from "react-contexify";
import { BiChevronDown, BiChevronUp } from "react-icons/bi";
import { Checkbox } from "rsuite";

export const dragHandleWidth = 10;

interface SortingBarProps<ResourceType> {
    readonly updateSortingColumnWidths: InstanceType<
        typeof ResourceList
    >["updateSortingColumnWidths"];
    readonly updateColumnDirections: InstanceType<typeof ResourceList>["updateColumnDirections"];
    readonly updateColumnVisibility: InstanceType<typeof ResourceList>["updateColumnVisibility"];
    readonly columns: Column<ResourceType>[];
    readonly resourceListId: string;
}

interface SortingBarState<ResourceType> {}

export default class SortingBar<ResourceType> extends Component<
    SortingBarProps<ResourceType>,
    SortingBarState<ResourceType>
> {
    constructor(props: SortingBarProps<ResourceType>) {
        super(props);
    }

    getId = () => {
        return this.props.resourceListId + "-sorting-bar";
    };

    shouldComponentUpdate(
        nextProps: Readonly<SortingBarProps<ResourceType>>,
        nextState: Readonly<SortingBarState<ResourceType>>,
        nextContext: any
    ): boolean {
        return (
            nextProps.columns.filter(c => c.visible).length !==
            this.props.columns.filter(c => c.visible).length
        );
    }

    componentDidUpdate(
        prevProps: Readonly<SortingBarProps<ResourceType>>,
        prevState: Readonly<SortingBarState<ResourceType>>,
        snapshot?: any
    ): void {
        console.log("SortingBar.componentDidUpdate");

        if (
            prevProps.columns.filter(c => c.visible).length !==
            this.props.columns.filter(c => c.visible).length
        ) {
            this.forceUpdate();
        }
    }

    render = () => {
        const { show } = useContextMenu({
            id: this.getId()
        });

        const activeColumns = this.props.columns.filter(c => c.visible);
        if (activeColumns.length === 0) {
            return;
        }

        return (
            <div
                className="SortingBar"
                onContextMenu={e => {
                    e.preventDefault();
                    show({ event: e });
                }}
            >
                <Split
                    gutterSize={dragHandleWidth}
                    className="Columns"
                    style={{
                        height: "20px",
                        width: "100%",
                        verticalAlign: "top",
                        display: "flex",
                        border: "1px solid var(--gutters)"
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
                <Menu id={this.getId()}>
                    {this.props.columns.map((column, index) => {
                        return (
                            <Item key={this.props.resourceListId + column.field + "-menu-item"}>
                                <Checkbox
                                    checked={column.visible}
                                    onChange={() =>
                                        this.props.updateColumnVisibility(
                                            column.field,
                                            !column.visible
                                        )
                                    }
                                />

                                <span>{column.field}</span>
                            </Item>
                        );
                    })}
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
