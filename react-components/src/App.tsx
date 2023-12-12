import { CSSProperties, Component, PureComponent, createRef } from "react";
import FilezProvider from "./FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import UserList from "./components/list/users/UserList";
import FileList from "./components/list/files/FileList";
import FileMetaEditor from "./components/metaEditor/FileMetaEditor";
import FilezFileViewer, { FileViewerViewMode } from "./components/viewer/FileViewer";
import UserGroupList from "./components/list/userGroups/UserGroupList";
import FileGroupList from "./components/list/fileGroups/FileGroupList";
import PermissionList from "./components/list/permissions/PermissionList";
import MultiItemTagPicker, {
    MultiItemTagPickerResources
} from "./components/metaEditor/MultiItemTagPicker";
import { BaseResource } from "./components/list/resource/ResourceList";

interface AppProps {}

interface AppState {
    readonly selectedFileId?: string;
    readonly selectedGroupId: string;
}

export default class App extends Component<AppProps, AppState> {
    fileGroupListRef = createRef<FileGroupList>();

    constructor(props: AppProps) {
        super(props);
        this.state = {
            selectedFileId: "kgBRBXqBXrHZBuHF",
            selectedGroupId: "KgmuP8hQvO6gTL0Q_all"
        };
    }

    onGroupClick = (
        e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
        item: BaseResource,
        rightClick?: boolean | undefined
    ) => {
        if (rightClick) return;
        this.setState({ selectedGroupId: item._id });
    };

    onFileClick = (
        e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
        item: BaseResource,
        rightClick?: boolean | undefined
    ) => {
        if (rightClick) return;
        this.setState({ selectedFileId: item._id });
    };

    onFileListChange = () => {
        this.fileGroupListRef.current?.resourceListRef.current?.refreshList();
    };

    render = () => {
        return (
            <div className="App">
                <FilezProvider>
                    <FileList
                        style={{ height: "500px" }}
                        resourceListRowHandlers={{
                            onClick: this.onFileClick
                        }}
                        handlers={{ onChange: this.onFileListChange }}
                        id={this.state.selectedGroupId}
                    />
                    <FileGroupList
                        ref={this.fileGroupListRef}
                        style={{ height: "500px", width: "500px", float: "left" }}
                        resourceListRowHandlers={{ onClick: this.onGroupClick }}
                    />

                    <FilezFileViewer
                        viewMode={FileViewerViewMode.Full}
                        style={{ width: "500px", float: "left", height: "500px" }}
                        fileId={this.state.selectedFileId}
                    />
                </FilezProvider>
            </div>
        );
    };
}

/*
                    <PermissionList style={{ height: "500px" }} />
                    <UserGroupList style={{ height: "500px" }} />
                    <UserList style={{ height: "500px" }} />
                    
                    <FileList
                        style={{ height: "500px" }}
                        rowHandlers={{ onClick: this.onFileClick }}
                        id={this.state.selectedGroupId}
                    />
                    <FileGroupList
                        style={{ height: "500px", width: "500px", float: "left" }}
                        rowHandlers={{ onClick: this.onGroupClick }}
                    />{" "}
                    <FilezFileViewer
                        viewMode={FileViewerViewMode.Full}
                        style={{ width: "500px", float: "left", height: "500px" }}
                        fileId={this.state.selectedFileId}
                    />
                    <PermissionList style={{ height: "500px" }} />
                    <UserGroupList style={{ height: "500px" }} />
                    <UserList style={{ height: "500px" }} />
  

  <FilezProvider>


                    <FileList style={{ height: "500px" }} id="KgmuP8hQvO6gTL0Q_all" />
                    <FileGroupList style={{ height: "500px" }} />
                    <PermissionList style={{ height: "500px" }} />
                    <UserGroupList style={{ height: "500px" }} />

                    <UserList style={{ height: "500px" }} />
                    <FilezFileViewer
                        style={{ width: "500px", float: "left", height: "500px" }}
                        fileId={this.state.selectedFileId}
                    />
                </FilezProvider>


                   <MultiItemTagPicker
                        resources={this.state.resources}
                        possibleTags={this.state.possibleTags}
                        onChange={(resources, possibleTags) => {
                            console.log(resources, possibleTags);

                            this.setState({ resources, possibleTags });
                        }}
                    />


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
