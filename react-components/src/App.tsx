import { CSSProperties, PureComponent } from "react";
import FilezProvider from "./FilezProvider";
import { FileGroup, FilezFile } from "@firstdorsal/filez-client";
import FilezFileViewer from "./components/FilezFileViewer";
import { isFile } from "./utils";
import FileList from "./components/list/files/FileList";
import GroupList from "./components/list/groups/GroupList";

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

    renderListItem = (item: FilezFile | FileGroup, style: CSSProperties) => {
        return (
            <div
                onClick={() => {
                    if (isFile(item)) {
                        this.setState({ selectedFile: item });
                    }
                }}
                style={style}
            >
                <div>{item.name}</div>
            </div>
        );
    };

    render = () => {
        return (
            <div className="App">
                <FilezProvider>
                    <GroupList style={{ width: "500px", float: "left" }} />
                    <FileList
                        rowRenderer={this.renderListItem}
                        id="JIapiYfZ5YQPmAs6T39vw3arVs03UBkZ_all"
                        style={{ width: "500px", float: "left", height: 500 }}
                        displayTopBar={true}
                    />
                    <FilezFileViewer file={this.state.selectedFile} />
                </FilezProvider>
            </div>
        );
    };
}
