import { PureComponent } from "react";
import Split from "react-split";
import FileList, { Column, ColumnDirection } from "./FileList";

interface SortingBarProps {
    readonly updateSortingColumnWidths: InstanceType<typeof FileList>["updateColumnWidths"];
    readonly updateColumnDirections: InstanceType<typeof FileList>["updateColumnDirections"];
    readonly columns: Column[];
}

interface SortingBarState {}

export default class SortingBar extends PureComponent<SortingBarProps, SortingBarState> {
    constructor(props: SortingBarProps) {
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
                                    {column.direction === ColumnDirection.ASCENDING && "▲"}
                                    {column.direction === ColumnDirection.DESCENDING && "▼"}
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
