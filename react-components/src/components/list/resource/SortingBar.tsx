import { PureComponent } from "react";
import Split from "react-split";
import ResourceList, { Column, ColumnDirection } from "./ResourceList";

interface SortingBarProps<ResourceType> {
    readonly updateSortingColumnWidths: InstanceType<
        typeof ResourceList
    >["updateSortingColumnWidths"];
    readonly updateColumnDirections: InstanceType<typeof ResourceList>["updateColumnDirections"];
    readonly columns: Column<ResourceType>[];
}

interface SortingBarState<ResourceType> {}

export default class SortingBar<ResourceType> extends PureComponent<
    SortingBarProps<ResourceType>,
    SortingBarState<ResourceType>
> {
    constructor(props: SortingBarProps<ResourceType>) {
        super(props);
    }

    render = () => {
        return (
            <div className="SortingBar">
                <Split
                    className="Columns"
                    style={{
                        height: "20px",
                        width: "calc(100% - 17px)",
                        verticalAlign: "top",
                        display: "flex"
                    }}
                    sizes={this.props.columns.map(column => column.width)}
                    minSize={this.props.columns.map(column => column.minWidth)}
                    direction="horizontal"
                    cursor="col-resize"
                    onDrag={this.props.updateSortingColumnWidths}
                >
                    {this.props.columns.map((column, index) => {
                        return (
                            <button
                                className="Filez"
                                key={column.field + index}
                                style={{
                                    textTransform: "capitalize",
                                    background: "none",
                                    border: "none",
                                    fontSize: "100%",
                                    color: "#fff",
                                    padding: "0",
                                    margin: "0",
                                    height: "100%"
                                }}
                                onClick={() => this.props.updateColumnDirections(index)}
                            >
                                {column.field}
                                <span style={{}}>
                                    {column.direction === ColumnDirection.ASCENDING && "▼"}
                                    {column.direction === ColumnDirection.DESCENDING && "▲"}
                                </span>
                            </button>
                        );
                    })}
                </Split>
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
