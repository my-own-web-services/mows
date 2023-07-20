import { Component } from "preact";
import { G } from "../../../App";
import Filter from "../../filter/Filter";
import "./Center.scss";
import SelectView from "./components/selectView/SelectView";
import Grid from "./components/views/grid/GridView";
import List from "./components/views/list/ListView";
import Single from "./components/views/single/Single";
import { FilezFile } from "@firstdorsal/filez-client";

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
    readonly search: string;
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
                <div className="CenterBar">
                    <SelectView
                        selectCenterView={this.props.g.fn.selectCenterView}
                        selectedView={this.props.selectedView}
                    />
                    <Filter search={this.props.search} g={this.props.g}></Filter>
                </div>
                <div className="view">
                    {(() => {
                        if (this.props.selectedView === View.Grid) {
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
