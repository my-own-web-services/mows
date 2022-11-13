import { Component } from "preact";
import Panels from "./components/panels/Panels";
import "@fontsource/inter/500.css";
import Left from "./components/panels/left/Left";
import Center from "./components/panels/center/Center";
import Right from "./components/panels/right/Right";
import Strip from "./components/panels/strip/Strip";
import { CustomProvider } from "rsuite";
import { FilezFile } from "./types";
import { getMockFiles } from "./utils/getMockFiles";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DndProvider } from "react-dnd";
interface AppProps {}
interface AppState {
    readonly files: FilezFile[];
}
export default class App extends Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            files: getMockFiles()
        };
    }

    render = () => {
        return (
            <CustomProvider theme="dark">
                <DndProvider backend={HTML5Backend}>
                    <div className="App">
                        <Panels
                            left={<Left></Left>}
                            center={<Center files={this.state.files}></Center>}
                            right={<Right></Right>}
                            strip={<Strip files={this.state.files}></Strip>}
                        />
                    </div>
                </DndProvider>
            </CustomProvider>
        );
    };
}
