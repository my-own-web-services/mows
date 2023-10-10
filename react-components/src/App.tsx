import { CSSProperties, PureComponent } from "react";
import FilezProvider from "./FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client";
import FileViewer from "./components/viewer/FileViewer";
import FileList from "./components/list/files/FileList";
import GroupList from "./components/list/groups/GroupList";
import FileMetaEditor from "./components/metaEditor/FileMetaEditor";

interface AppProps {}

interface AppState {
    readonly selectedFile?: FilezFile;
}

export default class App extends PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            selectedFile: undefined
        };
    }

    renderListItem = (item: FilezFile, style: CSSProperties) => {
        return (
            <div
                className="Filez clickable"
                onClick={() => {
                    this.setState({ selectedFile: item });
                }}
                style={{ ...style }}
            >
                <div>{item.name}</div>
            </div>
        );
    };

    render = () => {
        return (
            <div className="App">
                <FilezProvider>
                    <GroupList
                        displayTopBar={true}
                        style={{ width: "300px", float: "left", height: "500px" }}
                    />
                    <FileList
                        id="5-qVs7E3ApgltzTUgyfegCcymbBXnEni"
                        style={{ width: "500px", float: "left", height: "500px" }}
                        displayTopBar={true}
                        drrOnClick={item => {
                            this.setState({ selectedFile: item });
                        }}
                    />
                    <FileViewer
                        style={{ width: "500px", float: "left", height: "500px" }}
                        file={this.state.selectedFile}
                    />
                    <FileMetaEditor
                        style={{ width: "500px", float: "left", height: "500px" }}
                        file={this.state.selectedFile}
                    />
                </FilezProvider>
            </div>
        );
    };
}
