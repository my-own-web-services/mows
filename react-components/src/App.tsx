import { PureComponent } from "react";
import Filez from "./Filez";
import FilezList from "./FilezList";

interface AppProps {}

interface AppState {}

export default class App extends PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        return (
            <div className="App">
                <Filez>
                    <FilezList type="groups" style={{ width: "500px", float: "left" }}></FilezList>
                    <FilezList
                        type="files"
                        id="dev_all"
                        style={{ width: "500px", float: "left", height: 500 }}
                    ></FilezList>
                </Filez>
            </div>
        );
    };
}
