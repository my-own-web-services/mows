import { CSSProperties, PureComponent } from "react";
import FilezProvider from "./FilezProvider";
import FileViewer from "./components/viewer/FileViewer";
import FileList, { ListType } from "./components/list/files/FileList";
import GroupList from "./components/list/groups/GroupList";
import FileMetaEditor from "./components/metaEditor/FileMetaEditor";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

interface AppProps {}

interface AppState {
    readonly selectedFileId?: string;
}

export default class App extends PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            selectedFileId: "Fk89LMiInn_34B3u"
        };
    }

    renderListItem = (item: FilezFile, style: CSSProperties) => {
        return (
            <div
                className="Filez clickable"
                onClick={() => {
                    this.setState({ selectedFileId: item._id });
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
                            this.setState({ selectedFileId: item._id });
                        }}
                    />
                    <FileViewer
                        style={{ width: "500px", float: "left", height: "500px" }}
                        fileId={this.state.selectedFileId}
                    />
                    {this.state.selectedFileId && (
                        <FileMetaEditor
                            style={{ width: "500px", float: "left", height: "500px" }}
                            fileId={this.state.selectedFileId}
                        />
                    )}
                </FilezProvider>
            </div>
        );
    };
}
