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

interface TopBarProps {}

interface TopBarState {
    readonly columns: Column[];
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

export default class TopBar extends PureComponent<TopBarProps, TopBarState> {
    constructor(props: TopBarProps) {
        super(props);
        this.state = {
            columns: [...defaultColumns]
        };
    }

    render = () => {
        return (
            <div style={{ width: "100%", height: "40px" }} className="TopBar">
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
                                    style={{
                                        top: "10px",
                                        position: "absolute",
                                        textTransform: "capitalize",
                                        userSelect: "none",
                                        cursor: "pointer",
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
                        background: "none",
                        border: "none",
                        height: "100%",
                        cursor: "pointer",
                        width: "45px",
                        display: "inline-block"
                    }}
                    className="AddColumn"
                    title="Add column"
                >
                    <RiInsertColumnRight size={35} color={"#fff"} style={{ height: "100%" }} />
                </button>
            </div>
        );
    };
}
