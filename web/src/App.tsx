import { Component } from "preact";
import Panels from "./components/panels/Panels";
import "@fontsource/inter/500.css";
import Left from "./components/panels/left/Left";
import Center, { View } from "./components/panels/center/Center";
import Right from "./components/panels/right/Right";
import Strip from "./components/panels/strip/Strip";
import { CustomProvider } from "rsuite";
import { FileView, ReducedFilezFile } from "./types";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DndProvider } from "react-dnd";
import update from "immutability-helper";
import { JSXInternal } from "preact/src/jsx";
import { convertFileGroups, VisualFileGroup } from "./utils/convertFileGroups";
import { FilezClient } from "./utils/filezClient";
import "rsuite/styles/index.less";
import "preact/debug";

interface AppProps {}
interface AppState {
    readonly files: ReducedFilezFile[];
    readonly fileGroups: VisualFileGroup[];
    readonly g: G;
    readonly selectedCenterView: View;
    readonly lastSelectedCenterView: View;
    readonly gridColumns: number;
}

export interface G {
    readonly selectedFiles: ReducedFilezFile[];
    readonly selectedGroups: VisualFileGroup[];
    readonly selectedFile: ReducedFilezFile | null;
    readonly selectedGroup: VisualFileGroup | null;
    readonly filezClient: FilezClient;
    readonly fn: Fn;
}

export interface Fn {
    readonly itemClick: App["itemClick"];
    readonly groupArrowClick: App["groupArrowClick"];
    readonly groupDoubleClick: App["groupDoubleClick"];
    readonly fileDoubleClick: App["fileDoubleClick"];
    readonly selectCenterView: App["selectCenterView"];
    readonly setGridViewColumns: App["setGridViewColumns"];
    readonly loadMoreFiles: App["loadMoreFiles"];
}

export enum SelectItem {
    File,
    Group
}

export default class App extends Component<AppProps, AppState> {
    allFileGroups: VisualFileGroup[];
    moreFilesLoading = false;
    constructor(props: AppProps) {
        super(props);
        this.allFileGroups = [];
        this.state = {
            files: [],
            fileGroups: [],
            selectedCenterView: View.Grid,
            lastSelectedCenterView: View.Grid,
            gridColumns: 10,
            g: {
                selectedFiles: [],
                selectedGroups: [],
                selectedFile: null,
                selectedGroup: null,
                filezClient: new FilezClient("http://localhost:8081"),
                fn: {
                    itemClick: this.itemClick,
                    groupArrowClick: this.groupArrowClick,
                    groupDoubleClick: this.groupDoubleClick,
                    fileDoubleClick: this.fileDoubleClick,
                    selectCenterView: this.selectCenterView,
                    setGridViewColumns: this.setGridViewColumns,
                    loadMoreFiles: this.loadMoreFiles
                }
            }
        };
    }

    componentDidMount = async () => {
        this.allFileGroups = convertFileGroups(
            await this.state.g.filezClient.get_own_file_groups()
        );
        this.setState({ fileGroups: this.allFileGroups });
    };

    itemClick = (
        item: ReducedFilezFile | VisualFileGroup,
        isSelected: boolean,
        e: JSXInternal.TargetedMouseEvent<any>
    ) => {
        e.preventDefault();
        if (e.ctrlKey) {
            if (isSelected) {
                this.deselectItem(item);
            } else {
                this.selectItem(item);
            }
        } else {
            if (item.hasOwnProperty("clientId")) {
                this.setState(state => {
                    return update(state, {
                        g: { selectedGroups: { $set: [item as VisualFileGroup] } }
                    });
                });
            } else {
                this.setState(state => {
                    return update(state, {
                        g: { selectedFiles: { $set: [item as ReducedFilezFile] } }
                    });
                });
            }
        }
    };

    selectItem = (item: ReducedFilezFile | VisualFileGroup) => {
        if (item.hasOwnProperty("clientId")) {
            this.setState(state => {
                return update(state, {
                    g: { selectedGroups: { $push: [item as VisualFileGroup] } }
                });
            });
        } else {
            this.setState(state => {
                return update(state, {
                    g: { selectedFiles: { $push: [item as ReducedFilezFile] } }
                });
            });
        }
    };

    groupArrowClick = (group: VisualFileGroup) => {
        this.setState(state => {
            return update(state, {
                fileGroups: {
                    $set: this.filterFileGroups(group)
                }
            });
        });
    };

    filterFileGroups = (group?: VisualFileGroup) => {
        const newFileGroups: VisualFileGroup[] = [];
        let foundDepth = 0;
        let hide = false;
        // if hide is true we don't add the group to the newFileGroups array
        // hide is reset if the depth of the group is less than the foundDepth
        // foundDepth is set to the depth of the group if the
        for (let i = 0; i < this.allFileGroups.length; i++) {
            const fg = this.allFileGroups[i];

            if (hide && fg.depth <= foundDepth) {
                hide = false;
            }

            if (!hide) {
                if (group && fg.clientId === group.clientId) {
                    fg.isOpen = !fg.isOpen;
                }

                if (fg.isOpen === false) {
                    hide = true;
                    foundDepth = fg.depth;
                }

                newFileGroups.push(fg);
            }
        }
        return newFileGroups;
    };

    setGridViewColumns = (columns: number) => {
        this.setState({ gridColumns: columns });
    };

    deselectItem = (item: ReducedFilezFile | VisualFileGroup) => {
        if (item.hasOwnProperty("clientId")) {
            this.setState(state => {
                return update(state, {
                    g: {
                        selectedGroups: {
                            $set: state.g.selectedGroups.filter(
                                g => g.clientId !== (item as VisualFileGroup).clientId
                            )
                        }
                    }
                });
            });
        } else {
            this.setState(state => {
                return update(state, {
                    g: {
                        selectedFiles: {
                            $set: state.g.selectedFiles.filter(
                                f => f._id !== (item as ReducedFilezFile)._id
                            )
                        }
                    }
                });
            });
        }
    };

    groupDoubleClick = (group: VisualFileGroup) => {
        if (group?.fileGroup) {
            this.state.g.filezClient
                .get_file_infos_by_group_id(group.fileGroup._id, 0, 100)
                .then(files => {
                    this.setState({ files });
                    this.setState(state => {
                        return update(state, {
                            g: {
                                selectedGroup: { $set: group }
                            }
                        });
                    });
                });
        } else {
            this.setState({ files: [] });
            this.setState(state => {
                return update(state, {
                    g: {
                        selectedGroup: { $set: group }
                    }
                });
            });
        }
    };

    loadMoreFiles = async (startIndex: number, stopIndex: number) => {
        const group = this.state.g.selectedGroup;
        const groupIndex = group?.fileGroup?._id;
        //        console.log("loadMoreFiles", startIndex, stopIndex, groupIndex);

        if (groupIndex && this.moreFilesLoading === false) {
            this.moreFilesLoading = true;
            const newFiles = await this.state.g.filezClient.get_file_infos_by_group_id(
                groupIndex,
                startIndex,
                stopIndex - startIndex
            );
            this.moreFilesLoading = false;

            this.setState(({ files }) => {
                for (let i = 0; i < newFiles.length; i++) {
                    files[startIndex + i] = newFiles[i];
                }
                return { files };
            });
        }
    };

    fileDoubleClick = (file: ReducedFilezFile, clickOrigin: FileView) => {
        this.setState(state => {
            state = update(state, {
                g: {
                    selectedFile: {
                        $set: file
                    }
                }
            });

            return state;
        });

        if (clickOrigin === FileView.Strip) {
            this.setState(state => ({
                selectedCenterView: View.Single,

                ...(state.selectedCenterView !== View.Single && {
                    lastSelectedCenterView: state.selectedCenterView
                })
            }));
        } else {
            this.setState(state => ({
                selectedCenterView:
                    this.state.selectedCenterView === View.Single
                        ? state.lastSelectedCenterView
                        : View.Single,
                ...(state.selectedCenterView !== View.Single && {
                    lastSelectedCenterView: state.selectedCenterView
                })
            }));
        }
    };

    selectCenterView = (selectedCenterView: View) => {
        this.setState(state => ({
            selectedCenterView,
            ...(state.selectedCenterView !== View.Single && {
                lastSelectedCenterView: state.selectedCenterView
            })
        }));
    };

    render = () => {
        return (
            <CustomProvider theme="dark">
                <DndProvider backend={HTML5Backend}>
                    <div className="App">
                        <Panels
                            left={<Left g={this.state.g} groups={this.state.fileGroups}></Left>}
                            center={
                                <Center
                                    columns={this.state.gridColumns}
                                    selectedView={this.state.selectedCenterView}
                                    g={this.state.g}
                                    files={this.state.files}
                                ></Center>
                            }
                            right={<Right g={this.state.g} files={this.state.files}></Right>}
                            strip={<Strip g={this.state.g} files={this.state.files}></Strip>}
                        />
                    </div>
                </DndProvider>
            </CustomProvider>
        );
    };
}
