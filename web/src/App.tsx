import { Component } from "preact";
import Panels from "./components/panels/Panels";
import "@fontsource/inter/500.css";
import Left from "./components/panels/left/Left";
import Center from "./components/panels/center/Center";
import Right from "./components/panels/right/Right";
import Strip from "./components/panels/strip/Strip";
import { CustomProvider } from "rsuite";
import { FileGroup, FilezFile } from "./types";
import { getMockFiles, getMockGroups } from "./utils/getMock";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DndProvider } from "react-dnd";
import update from "immutability-helper";
import { JSXInternal } from "preact/src/jsx";

interface AppProps {}
interface AppState {
    readonly files: FilezFile[];
    readonly groups: FileGroup[];
    readonly g: G;
}

export interface G {
    readonly selectedFiles: FilezFile[];
    readonly selectedGroups: FileGroup[];
    readonly fn: Fn;
}

export interface Fn {
    readonly itemClick: App["itemClick"];
}

export enum SelectItem {
    File,
    Group
}

export default class App extends Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            files: getMockFiles(),
            groups: getMockGroups(),
            g: {
                selectedFiles: [],
                selectedGroups: [],
                fn: {
                    itemClick: this.itemClick
                }
            }
        };
    }

    itemClick = (
        item: FilezFile | FileGroup,
        isSelected: boolean,
        e: JSXInternal.TargetedMouseEvent<HTMLDivElement>
    ) => {
        e.preventDefault();
        if (e.ctrlKey) {
            if (isSelected) {
                this.deselectItem(item);
            } else {
                this.selectItem(item);
            }
        } else {
            if (item.hasOwnProperty("fileId")) {
                this.setState(state => {
                    return update(state, {
                        g: { selectedFiles: { $set: [item as FilezFile] } }
                    });
                });
            } else if (item.hasOwnProperty("groupId")) {
                this.setState(state => {
                    return update(state, {
                        g: { selectedGroups: { $set: [item as FileGroup] } }
                    });
                });
            }
        }
    };

    selectItem = (item: FilezFile | FileGroup) => {
        if (item.hasOwnProperty("fileId")) {
            this.setState(state => {
                return update(state, { g: { selectedFiles: { $push: [item as FilezFile] } } });
            });
        } else if (item.hasOwnProperty("groupId")) {
            this.setState(state => {
                return update(state, { g: { selectedGroups: { $push: [item as FileGroup] } } });
            });
        }
    };

    deselectItem = (item: FilezFile | FileGroup) => {
        if (item.hasOwnProperty("fileId")) {
            this.setState(state => {
                return update(state, {
                    g: {
                        selectedFiles: {
                            $set: state.g.selectedFiles.filter(
                                f => f.fileId !== (item as FilezFile).fileId
                            )
                        }
                    }
                });
            });
        } else if (item.hasOwnProperty("groupId")) {
            this.setState(state => {
                return update(state, {
                    g: {
                        selectedGroups: {
                            $set: state.g.selectedGroups.filter(
                                g => g.groupId !== (item as FileGroup).groupId
                            )
                        }
                    }
                });
            });
        }
    };

    render = () => {
        return (
            <CustomProvider theme="dark">
                <DndProvider backend={HTML5Backend}>
                    <div className="App">
                        <Panels
                            left={<Left g={this.state.g} groups={this.state.groups}></Left>}
                            center={<Center g={this.state.g} files={this.state.files}></Center>}
                            right={<Right g={this.state.g}></Right>}
                            strip={<Strip g={this.state.g} files={this.state.files}></Strip>}
                        />
                    </div>
                </DndProvider>
            </CustomProvider>
        );
    };
}
