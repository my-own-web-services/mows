import { CSSProperties, PureComponent } from "react";
import FilezProvider from "./FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import UserList from "./components/list/users/UserList";
import FileList from "./components/list/files/FileList";
import FileMetaEditor from "./components/metaEditor/FileMetaEditor";
import FilezFileViewer from "./components/viewer/FileViewer";
import UserGroupList from "./components/list/userGroups/UserGroupList";
import FileGroupList from "./components/list/fileGroups/FileGroupList";

interface AppProps {}

interface AppState {
    readonly selectedFileId?: string;
}

export default class App extends PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {};
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
                    <UserGroupList style={{ height: "500px" }} />
                </FilezProvider>
            </div>
        );
    };
}

/*
<FileList style={{ height: "500px" }} id="1iVsRnLWVjM_L8mB" />
                    <FileGroupList style={{ height: "500px" }} />
                    <UserList style={{ height: "500px" }} />


 <UserList style={{ height: "400px" }} />
                    <UserGroupList style={{ height: "400px" }} />

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
                    <FilezFileViewer
                        style={{ width: "500px", float: "left", height: "500px" }}
                        fileId={this.state.selectedFileId}
                    />
                    {this.state.selectedFileId && (
                        <FileMetaEditor
                            style={{ width: "500px", float: "left", height: "500px" }}
                            fileId={this.state.selectedFileId}
                        />
                    )}

*/
