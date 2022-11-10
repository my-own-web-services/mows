import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { FilezFile } from "../../../../../../types";
import "./GridRow.scss";

interface GridRowProps {
    style: CSSProperties;
    files: FilezFile[];
    columns: number;
}
interface GridRowState {}
export default class GridRow extends Component<GridRowProps, GridRowState> {
    render = () => {
        console.log(this.props.files);

        return (
            <div className="GridRow" style={{ ...this.props.style }}>
                {this.props.files.map((file, index) => {
                    return (
                        <div
                            className="GridRowItem"
                            style={{ width: `${100 / this.props.columns}%`, height: "100%" }}
                            key={index}
                        ></div>
                    );
                })}
            </div>
        );
    };
}
