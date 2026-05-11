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
        oidc={{
            // Local supervisor is bearer-token authed; OIDC is mounted only
            // because mows-components-react requires the prop. A real issuer
            // is wired in once the supervisor sits behind an SSO proxy.
            issuerUrl: "https://example.invalid",
            clientId: "mows-vm-supervisor"
        }}
        defaultThemeId="dark"
        languages={languages}
        initialTranslation={initialTranslation}
        extraActions={buildExtraActions()}
    >
        <App />
        <Toaster richColors closeButton position="bottom-right" />
    </MowsProvider>
);
