import "@fontsource-variable/inter";
import { MowsProvider } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";
import { buildExtraActions, registerContextScopeListener } from "./lib/actions";
import { initialTranslation, languages } from "./lib/languages";

// Capture-phase context-menu observer for the action-scope payload.
// Registered once at boot; HMR disposes the previous registration so
// repeated reloads don't stack duplicate listeners (TASTE-15).
const disposeContextScope = registerContextScopeListener();
if (import.meta.hot) {
    import.meta.hot.dispose(disposeContextScope);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <MowsProvider
        storagePrefix="mows-vm-supervisor"
        defaultThemeId="dark"
        languages={languages}
        initialTranslation={initialTranslation}
        extraActions={buildExtraActions()}
    >
        <App />
        <Toaster richColors closeButton />
    </MowsProvider>
);
