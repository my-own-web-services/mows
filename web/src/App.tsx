import { Component } from "preact";
import Panels from "./components/panels/Panels";
import "@fontsource/inter/500.css";
import Left from "./components/panels/left/Left";
import Center from "./components/panels/center/Center";
import Right from "./components/panels/right/Right";
import Strip from "./components/panels/strip/Strip";

interface AppProps {}
interface AppState {}
export default class App extends Component<AppProps, AppState> {
    render = () => {
        return (
            <div className="App">
                <Panels
                    left={<Left></Left>}
                    center={<Center></Center>}
                    right={<Right></Right>}
                    strip={<Strip></Strip>}
                />
            </div>
        );
    };
}
