import { CSSProperties, Component, PureComponent } from "react";
import FilezProvider from "./FilezProvider";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import UserList from "./components/list/users/UserList";
import FileList from "./components/list/files/FileList";
import FileMetaEditor from "./components/metaEditor/FileMetaEditor";
import FilezFileViewer from "./components/viewer/FileViewer";
import UserGroupList from "./components/list/userGroups/UserGroupList";
import FileGroupList from "./components/list/fileGroups/FileGroupList";
import PermissionList from "./components/list/permissions/PermissionList";
import MultiItemTagPicker, {
    MultiItemTagPickerResources
} from "./components/metaEditor/MultiItemTagPicker";

interface AppProps {}

interface AppState {
    readonly selectedFileId?: string;
    readonly resources: MultiItemTagPickerResources;
    readonly possibleTags: string[];
}

export default class App extends Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            selectedFileId: "4A7lGTlhgk20IbS6",
            resources: {
                A: ["Paul", "Olaf"],
                B: ["Peter", "Paul", "Karl"]
            },
            possibleTags: [
                "Kai",
                "Christoph",
                "Paul",
                "Olaf",
                "Peter",
                "Rüdiger",
                "Christian",
                "Klaus",
                "Karl",
                "Kurt",
                "Jürgen"
            ]
        };
    }

    render = () => {
        return (
            <div className="App">
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
            </div>
        );
    };
}

/*

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
