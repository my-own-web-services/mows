import CommandPalette from "@my-own-web-services/react-components/components/appShell/commandPalette/CommandPalette";
import GlobalContextMenu from "@my-own-web-services/react-components/components/appShell/globalContextMenu/GlobalContextMenu";
import ModalHandler from "@my-own-web-services/react-components/components/appShell/modalHandler/ModalHandler";
import PrimaryMenu from "@my-own-web-services/react-components/components/appShell/primaryMenu/PrimaryMenu";
import { PureComponent } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Api } from "./api-client";
import CustomNavbar from "./components/CustomNavbar";
import Dev from "./components/Dev";
import Home from "./components/Home";
import { handleClusterStatusUpdate, handleConfigUpdate, handleMachineStatusUpdate } from "./config";

interface AppProps {}

interface AppState {}

export default class App extends PureComponent<AppProps, AppState> {
    client: Api<unknown>;
    origin: string;

    constructor(props: AppProps) {
        super(props);
        this.origin = `localhost:3000`;

        this.client = new Api({ baseUrl: `http://` + this.origin });
    }

    componentDidMount = async () => {
        await handleConfigUpdate(this.origin);
        await handleMachineStatusUpdate(this.origin);
        await handleClusterStatusUpdate(this.origin);
    };

    render = () => (
        <div className={`App min-h-screen w-full text-foreground`}>
            <BrowserRouter>
                <CustomNavbar />
                <main
                    className={`Page min-h-screen w-full py-4`}
                    style={{ paddingLeft: 76, paddingRight: 76 }}
                >
                    <Routes>
                        <Route path={`/`} element={<Home />} />
                        <Route path={`/devtools/`} element={<Dev client={this.client} />} />
                    </Routes>
                </main>
            </BrowserRouter>
            <PrimaryMenu />
            <CommandPalette />
            <ModalHandler />
            <GlobalContextMenu />
        </div>
    );
}
