import { Component } from "preact";
import Panels from "./components/panels/Panels";
import "@fontsource/inter/500.css";
import Left from "./components/panels/left/Left";
import Center, { View } from "./components/panels/center/Center";
import Right from "./components/panels/right/Right";
import Strip from "./components/panels/strip/Strip";
import { CustomProvider } from "rsuite";
import { FileGroup, FilezFile } from "./types";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DndProvider } from "react-dnd";
import update from "immutability-helper";
import { JSXInternal } from "preact/src/jsx";
import { convertFileGroups, VisualFileGroup } from "./utils/convertFileGroups";
import { FilezClient } from "./utils/filezClient";

interface AppProps {}
interface AppState {
    readonly files: FilezFile[];
    readonly fileGroups: VisualFileGroup[];
    readonly g: G;
    readonly selectedCenterView: View;
}

export interface G {
    readonly selectedFiles: FilezFile[];
    readonly selectedGroups: VisualFileGroup[];
    readonly selectedFile: FilezFile | null;
    readonly fn: Fn;
}

export interface Fn {
    readonly itemClick: App["itemClick"];
    readonly groupArrowClick: App["groupArrowClick"];
    readonly groupDoubleClick: App["groupDoubleClick"];
    readonly fileDoubleClick: App["fileDoubleClick"];
    readonly selectCenterView: App["selectCenterView"];
}

export enum SelectItem {
    File,
    Group
}

export default class App extends Component<AppProps, AppState> {
    allFileGroups: VisualFileGroup[];
    filezClient = new FilezClient();
    constructor(props: AppProps) {
        super(props);
        this.allFileGroups = [];
        this.state = {
            files: [],
            fileGroups: [],
            selectedCenterView: View.Grid,
            g: {
                selectedFiles: [],
                selectedGroups: [],
                selectedFile: null,
                fn: {
                    itemClick: this.itemClick,
                    groupArrowClick: this.groupArrowClick,
                    groupDoubleClick: this.groupDoubleClick,
                    fileDoubleClick: this.fileDoubleClick,
                    selectCenterView: this.selectCenterView
                }
            }
        };
    }

    componentDidMount = async () => {
        this.allFileGroups = convertFileGroups(await this.filezClient.get_own_file_groups());
        this.setState({ fileGroups: this.allFileGroups });
    };

    itemClick = (
        item: FilezFile | VisualFileGroup,
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
                        g: { selectedFiles: { $set: [item as FilezFile] } }
                    });
                });
            }
        }
    };

    selectItem = (item: FilezFile | VisualFileGroup) => {
        if (item.hasOwnProperty("clientId")) {
            this.setState(state => {
                return update(state, {
                    g: { selectedGroups: { $push: [item as VisualFileGroup] } }
                });
            });
        } else {
            this.setState(state => {
                return update(state, {
                    g: { selectedFiles: { $push: [item as FilezFile] } }
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

    deselectItem = (item: FilezFile | VisualFileGroup) => {
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
                                f => f._key !== (item as FilezFile)._key
                            )
                        }
                    }
                });
            });
        }
    };

    groupDoubleClick = (group: VisualFileGroup) => {
        if (group?.fileGroup) {
            this.filezClient.get_file_infos_by_group_id(group.fileGroup._key).then(files => {
                this.setState({ files });
            });
        } else {
            this.setState({ files: [] });
        }
    };

    fileDoubleClick = (file: FilezFile) => {
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
        this.setState({
            selectedCenterView:
                this.state.selectedCenterView === View.Single ? View.Grid : View.Single
        });
    };

    selectCenterView = (selectedCenterView: View) => {
        this.setState({ selectedCenterView });
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
