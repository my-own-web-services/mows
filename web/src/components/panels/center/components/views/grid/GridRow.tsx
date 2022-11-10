import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { FilezFile } from "../../../../../../types";
import "./GridRow.scss";

interface GridRowProps {
    readonly style: CSSProperties;
    readonly rowIndex: number;
    readonly files: FilezFile[];
    readonly columns: number;
}
interface GridRowState {}
export default class GridRow extends Component<GridRowProps, GridRowState> {
    render = () => {
        return (
            <div className="GridRow" style={{ ...this.props.style }}>
                {this.props.files.map((file, index) => {
                    return (
                        <div
                            className="GridRowItem"
                            style={{ width: `${100 / this.props.columns}%`, height: "100%" }}
                            key={"GridRow" + this.props.rowIndex + index}
                        ></div>
                    );
                })}
            </div>
        );
    };
}
