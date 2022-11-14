import { Component } from "preact";
import Panels from "./components/panels/Panels";
import "@fontsource/inter/500.css";
import Left from "./components/panels/left/Left";
import Center from "./components/panels/center/Center";
import Right from "./components/panels/right/Right";
import Strip from "./components/panels/strip/Strip";
import { CustomProvider } from "rsuite";
import { FileGroup, FilezFile } from "./types";
import { getMockFiles, getMockFileGroups } from "./utils/getMock";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DndProvider } from "react-dnd";
import update from "immutability-helper";
import { JSXInternal } from "preact/src/jsx";
import { convertFileGroups, VisualFileGroup } from "./utils/convertFileGroups";

interface AppProps {}
interface AppState {
    readonly files: FilezFile[];
    readonly fileGroups: VisualFileGroup[];
    readonly g: G;
}

export interface G {
    readonly selectedFiles: FilezFile[];
    readonly selectedGroups: VisualFileGroup[];
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
            fileGroups: convertFileGroups(getMockFileGroups()),
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
        item: FilezFile | VisualFileGroup,
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
                        g: { selectedGroups: { $set: [item as VisualFileGroup] } }
                    });
                });
            }
        }
    };

    selectItem = (item: FilezFile | VisualFileGroup) => {
        if (item.hasOwnProperty("fileId")) {
            this.setState(state => {
                return update(state, { g: { selectedFiles: { $push: [item as FilezFile] } } });
            });
        } else if (item.hasOwnProperty("groupId")) {
            this.setState(state => {
                return update(state, {
                    g: { selectedGroups: { $push: [item as VisualFileGroup] } }
                });
            });
        }
    };

    deselectItem = (item: FilezFile | VisualFileGroup) => {
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
                                g => g.name !== (item as VisualFileGroup).name
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
                            left={<Left g={this.state.g} groups={this.state.fileGroups}></Left>}
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
