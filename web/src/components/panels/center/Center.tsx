import { Component } from "preact";
import { G } from "../../../App";
import { FilezFile } from "../../../types";
import "./Center.scss";
import SelectView from "./components/selectView/SelectView";
import Grid from "./components/views/grid/GridView";
import List from "./components/views/list/ListView";
import Sheets from "./components/views/sheets/Sheets";
import Single from "./components/views/single/Single";

export enum View {
    Grid = "Grid",
    List = "List",
    Single = "Single",
    Sheets = "Sheets"
}

interface CenterProps {
    readonly g: G;
    readonly files: FilezFile[];
    readonly selectedView: View;
}

interface CenterState {}

export default class Center extends Component<CenterProps, CenterState> {
    constructor(props: CenterProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        return (
            <div id="main-panel-center" className="horizontal-panel panel">
                <SelectView
                    selectCenterView={this.props.g.fn.selectCenterView}
                    selectedView={this.props.selectedView}
                />
                <div className="view">
                    {(() => {
                        if (this.props.selectedView === View.Sheets) {
                            return <Sheets g={this.props.g} />;
                        } else if (this.props.selectedView === View.Grid) {
                            return <Grid g={this.props.g} files={this.props.files} />;
                        } else if (this.props.selectedView === View.List) {
                            return <List g={this.props.g} files={this.props.files} />;
                        } else if (this.props.selectedView === View.Single) {
                            return <Single g={this.props.g} />;
                        } else {
                            return <div>Unknown view</div>;
                        }
                    })()}
                </div>
            </div>
        );
    };
}
