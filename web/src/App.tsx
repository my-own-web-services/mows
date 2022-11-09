import { Component } from "preact";
import Panels from "./components/panels/Panels";
import "@fontsource/inter";

interface AppProps {}
interface AppState {}
export default class App extends Component<AppProps, AppState> {
    render = () => {
        return (
            <div className="App">
                <Panels
                    left={
                        <div id="main-panel-left" className="horizontal-panel panel">
                            abc
                        </div>
                    }
                    center={
                        <div id="main-panel-center" className="horizontal-panel panel">
                            abc
                        </div>
                    }
                    right={
                        <div id="main-panel-right" className="horizontal-panel panel">
                            abc
                        </div>
                    }
                    strip={<div id="file-strip-panel" className="vertical-panel panel"></div>}
                />
            </div>
        );
    };
}
