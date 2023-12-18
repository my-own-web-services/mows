import { Component, createRef } from "react";
import FilezProvider from "./FilezProvider";
import FileList from "./components/list/FileList";
import FilezFileViewer, {
    FileViewerViewMode
} from "./components/viewer/FileViewer";
import FileGroupList from "./components/list/FileGroupList";

import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import {
    ResourceListHandlersOnSelect,
    ResourceListRowHandlersOnClick
} from "./components/list/resource/ResourceListTypes";
import { FileGroupType } from "@firstdorsal/filez-client/dist/js/apiTypes/FileGroupType";
import PermissionList from "./components/list/PermissionList";
import UserGroupList from "./components/list/UserGroupList";
import UserList from "./components/list/UserList";

interface AppProps {}

interface AppState {
    readonly selectedFileId?: string;
    readonly selectedGroupId?: string;
    readonly selectedGroupListSubType?: FileGroupType;
}

export default class App extends Component<AppProps, AppState> {
    fileGroupListRef = createRef<FileGroupList>();

    constructor(props: AppProps) {
        super(props);
        this.state = {
            selectedFileId: "kgBRBXqBXrHZBuHF",
            selectedGroupId: "KgmuP8hQvO6gTL0Q_all",
            selectedGroupListSubType: "Static"
        };
    }

    onGroupClick: ResourceListRowHandlersOnClick<FilezFileGroup> = (
        _e,
        item,
        _index,
        rightClick
    ) => {
        if (rightClick === true) return;
        this.setState({ selectedGroupId: item._id });
    };

    onFileClick: ResourceListRowHandlersOnClick<FilezFile> = (
        _e,
        item,
        _index,
        rightClick
    ) => {
        if (rightClick === true) return;
        this.setState({ selectedFileId: item._id });
    };

    onFileSelect: ResourceListHandlersOnSelect<FilezFile> = (
        _selectedFiles,
        lastSelectedItem
    ) => {
        this.setState({ selectedFileId: lastSelectedItem?._id });
    };

    onGroupSelect: ResourceListHandlersOnSelect<FilezFileGroup> = (
        _selectedGroups,
        lastSelectedItem
    ) => {
        this.setState({
            selectedGroupId: lastSelectedItem?._id,
            selectedGroupListSubType: lastSelectedItem?.group_type
        });
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
                        handlers={{
                            onChange: this.onFileListChange
                        }}
                        resourceListHandlers={{
                            onSelect: this.onFileSelect
                        }}
                        id={this.state.selectedGroupId}
                        listSubType={this.state.selectedGroupListSubType}
                    />
                    <div>
                        <FileGroupList
                            ref={this.fileGroupListRef}
                            style={{
                                height: "500px",
                                width: "500px",
                                display: "inline-block"
                            }}
                            resourceListHandlers={{
                                onSelect: this.onGroupSelect
                            }}
                            resourceListRowHandlers={{
                                onClick: this.onGroupClick
                            }}
                        />

                        <FilezFileViewer
                            viewMode={FileViewerViewMode.Full}
                            style={{
                                width: "500px",
                                height: "500px",
                                display: "inline-block"
                            }}
                            fileId={this.state.selectedFileId}
                        />
                    </div>

                    <PermissionList
                        style={{ height: "500px", width: "100%" }}
                    />
                    <UserGroupList style={{ height: "500px", width: "100%" }} />
                    <UserList style={{ height: "500px" }} />
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
