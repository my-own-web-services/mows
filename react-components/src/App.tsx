import { CSSProperties, PureComponent } from "react";
import FilezProvider from "./FilezProvider";
import FileViewer from "./components/viewer/FileViewer";
import FileList, { ListType } from "./components/list/files/FileList";
import GroupList from "./components/list/groups/GroupList";
import FileMetaEditor from "./components/metaEditor/FileMetaEditor";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

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
                        id="XD2oq1d7-ZpFWYWr"
                        style={{ width: "500px", float: "left", height: "500px" }}
                        initialListType={ListType.List}
                        drrOnClick={item => {
                            this.setState({ selectedFile: item });
                        }}
                    />
                    <FileViewer
                        style={{ width: "500px", float: "left", height: "500px" }}
                        file={this.state.selectedFile}
                    />
                    {this.state.selectedFile && (
                        <FileMetaEditor
                            style={{ width: "500px", float: "left", height: "500px" }}
                            fileId={this.state.selectedFile._id}
                        />
                    )}
                </FilezProvider>
            </div>
        );
    };
}
