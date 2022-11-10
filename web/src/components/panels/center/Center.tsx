import { Component } from "preact";
import { FilezFile } from "../../../types";
import { getMockFiles } from "../../../utils/getMockFiles";
import "./Center.scss";
import SelectView from "./components/selectView/SelectView";
import Grid from "./components/views/grid/Grid";
import List from "./components/views/list/List";
import Sheets from "./components/views/sheets/Sheets";
import Single from "./components/views/single/Single";

export enum View {
    Sheets = "Sheets",
    Grid = "Grid",
    List = "List",
    Single = "Single"
}

interface CenterProps {
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
                            return <Sheets />;
                        } else if (this.state.selectedView === View.Grid) {
                            return <Grid files={this.props.files} />;
                        } else if (this.state.selectedView === View.List) {
                            return <List />;
                        } else if (this.state.selectedView === View.Single) {
                            return <Single />;
                        } else {
                            return <div>Unknown view</div>;
                        }
                    })()}
                </div>
            </div>
        );
    };
}
