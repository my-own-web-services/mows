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
    Sheets = "Sheets",
    Grid = "Grid",
    List = "List",
    Single = "Single"
}

interface CenterProps {
    readonly g: G;
    readonly files: FilezFile[];
}

interface CenterState {
    readonly selectedView: View;
}

export default class Center extends Component<CenterProps, CenterState> {
    constructor(props: CenterProps) {
        super(props);
        this.state = {
            selectedView: View.Sheets
        };
    }

    selectView = (selectedView: View) => {
        this.setState({ selectedView });
    };

    render = () => {
        return (
            <div id="main-panel-center" className="horizontal-panel panel">
                <SelectView selectView={this.selectView} selectedView={this.state.selectedView} />
                <div className="view">
                    {(() => {
                        if (this.state.selectedView === View.Sheets) {
                            return <Sheets g={this.props.g} />;
                        } else if (this.state.selectedView === View.Grid) {
                            return <Grid g={this.props.g} files={this.props.files} />;
                        } else if (this.state.selectedView === View.List) {
                            return <List g={this.props.g} files={this.props.files} />;
                        } else if (this.state.selectedView === View.Single) {
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
