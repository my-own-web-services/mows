import "@my-own-web-services/react-components/main.css";
import { MowsProvider } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import ModalHandler from "@my-own-web-services/react-components/components/appShell/modalHandler/ModalHandler";
import GlobalContextMenu from "@my-own-web-services/react-components/components/appShell/globalContextMenu/GlobalContextMenu";
import { Toaster } from "@my-own-web-services/react-components/components/ui/sonner";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <MowsProvider storagePrefix="realtime-chat">
            {/* The four required mounts per the project convention:
                MowsProvider (above), then ModalHandler (modals),
                GlobalContextMenu (right-click affordances),
                Toaster (sonner). Apps that skip any of these
                lose those UX surfaces from the @mows components. */}
            <ModalHandler />
            <GlobalContextMenu />
            <Toaster position="top-right" />
            <App />
        </MowsProvider>
    </React.StrictMode>
);
