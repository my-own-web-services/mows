import { PureComponent } from "react";
import { RiInsertColumnRight } from "react-icons/ri";

interface Column {
    readonly field: string;
    readonly direction: ColumnDirection;
    readonly width?: number;
}

enum ColumnDirection {
    DESCENDING = 0,
    NEUTRAL = 1,
    ASCENDING = 2
}

const defaultColumns: Column[] = [
    {
        field: "name",
        direction: ColumnDirection.DESCENDING
    },
    {
        field: "size",
        direction: ColumnDirection.NEUTRAL
    }
];

interface ListBarProps {}

interface ListBarState {
    readonly columns: Column[];
}

export default class ListBar extends PureComponent<ListBarProps, ListBarState> {
    constructor(props: ListBarProps) {
        super(props);
        this.state = {
            columns: [...defaultColumns]
        };
    }

    render = () => {
        return (
            <div className="ListBar">
                <span
                    className="Columns"
                    style={{
                        height: "100%",
                        width: "calc(100% - 45px)",
                        display: "inline-block",
                        verticalAlign: "top"
                    }}
                >
                    {this.state.columns.map((column, index) => {
                        return (
                            <span
                                key={column.field + index}
                                style={{
                                    height: "100%",
                                    width: column.width ? column.width : "100px",
                                    display: "inline-block",
                                    position: "relative"
                                }}
                            >
                                <button
                                    className="Filez"
                                    style={{
                                        top: "10px",
                                        position: "absolute",
                                        textTransform: "capitalize",
                                        background: "none",
                                        border: "none",
                                        fontSize: "100%",
                                        color: "#fff",
                                        padding: "0",
                                        margin: "0"
                                    }}
                                >
                                    {column.field}
                                    <span style={{}}>
                                        {column.direction === ColumnDirection.ASCENDING && "▲"}
                                        {column.direction === ColumnDirection.DESCENDING && "▼"}
                                    </span>
                                </button>
                            </span>
                        );
                    })}
                </span>
                <button
                    style={{
                        height: "100%",
                        width: "45px",
                        display: "inline-block"
                    }}
                    className="Filez AddColumn"
                    title="Add column"
                >
                    <RiInsertColumnRight size={25} color={"#fff"} style={{ height: "100%" }} />
                </button>
            </div>
        );
    };
}
