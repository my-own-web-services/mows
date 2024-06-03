import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { G } from "../../../../../../App";
import { FileView } from "../../../../../../types";
import GroupOrFileItem from "../../../../../groupOrFile/GroupOrFileItem";
import "./GridRow.scss";
import { FilezFile } from "@firstdorsal/filez-client";

interface GridRowProps {
    readonly style: CSSProperties;
    readonly rowIndex: number;
    readonly files: FilezFile[];
    readonly columns: number;
    readonly g: G;
    readonly itemWidth: number;
}
interface GridRowState {}
export default class GridRow extends Component<GridRowProps, GridRowState> {
    render = () => {
        return (
            <div className="GridRow" style={{ ...this.props.style }}>
                {this.props.files.map((file, index) => {
                    if (!file) {
                        return null;
                    }
                    return (
                        <div
                            className="GridRowItem"
                            style={{ width: `${100 / this.props.columns}%`, height: "100%" }}
                            key={file._id}
                        >
                            <GroupOrFileItem
                                itemWidth={this.props.itemWidth}
                                viewType={FileView.Grid}
                                g={this.props.g}
                                file={file}
                            ></GroupOrFileItem>
                        </div>
                    );
                })}
            </div>
        );
    };
}
