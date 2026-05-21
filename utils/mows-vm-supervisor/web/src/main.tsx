import "@fontsource-variable/inter";
import { MowsProvider } from "mows-components-react/lib/mowsContext/MowsContext";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";
import { buildExtraActions } from "./lib/actions";
import { initialTranslation, languages } from "./lib/languages";

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
