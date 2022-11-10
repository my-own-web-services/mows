import { Component } from "preact";
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

interface CenterProps {}
interface CenterState {
    selectedView: View;
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
        const files = [];
        for (let i = 0; i < 500; i++) {
            files.push({
                fileId: Math.random().toString(36).substring(7),
                name: "test",
                mimeType: "application/pdf",
                ownerId: "1",
                sha256: "1",
                storageName: "1",
                size: 1,
                serverCreated: 1,
                created: 1,
                modified: 1,
                accessed: 1,
                accessedCount: 1,
                fileManualGroupIds: ["1"],
                timeOfDeath: 1,
                appData: {
                    "1": "1"
                },
                permissionIds: ["1"],
                keywords: ["1"]
            });
        }
        return (
            <div id="main-panel-center" className="horizontal-panel panel">
                <SelectView selectView={this.selectView} selectedView={this.state.selectedView} />
                <div className="view">
                    {(() => {
                        if (this.state.selectedView === View.Sheets) {
                            return <Sheets />;
                        } else if (this.state.selectedView === View.Grid) {
                            return <Grid files={files} />;
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
