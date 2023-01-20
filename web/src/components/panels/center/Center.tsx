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
    readonly columns: number;
}

interface CenterState {
    readonly scrollPosGrid: number;
    readonly scrollPosList: number;
}

export default class Center extends Component<CenterProps, CenterState> {
    constructor(props: CenterProps) {
        super(props);
        this.state = {
            scrollPosGrid: 0,
            scrollPosList: 0
        };
    }

    updateScrollPos = (scrollPos: number, viewType: View) => {
        if (viewType === View.Grid) {
            this.setState({ scrollPosGrid: scrollPos });
        } else if (viewType === View.List) {
            this.setState({ scrollPosList: scrollPos });
        }
    };

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
                            return (
                                <Grid
                                    updateScrollPos={this.updateScrollPos}
                                    scrollPos={this.state.scrollPosGrid}
                                    g={this.props.g}
                                    files={this.props.files}
                                    columns={this.props.columns}
                                />
                            );
                        } else if (this.props.selectedView === View.List) {
                            return (
                                <List
                                    g={this.props.g}
                                    files={this.props.files}
                                    scrollPos={this.state.scrollPosList}
                                    updateScrollPos={this.updateScrollPos}
                                />
                            );
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
