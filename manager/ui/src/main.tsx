import "@fontsource-variable/inter";
import { type Language } from "mows-components-react/lib/languages";
import { MowsProvider } from "mows-components-react/lib/mowsContext/MowsContext";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";
// Synchronous import for the synchronous initial-render fallback. The
// language-pack `import()` callbacks below stay async so the user-selected
// language is fetched lazily; this just guarantees that the very first
// render already has all `t.manager.*` keys defined.
import enInitial from "./languages/en-US";

const languages: Language[] = [
    {
        code: `en-US`,
        originalName: `English`,
        englishName: `English`,
        emoji: `🇺🇸`,
        import: () => import(`./languages/en-US`)
    },
    {
        code: `de`,
        originalName: `Deutsch`,
        englishName: `German`,
        emoji: `🇩🇪`,
        import: () => import(`./languages/de`)
    }
];

// The manager UI is an internal single-user tool that does not authenticate
// users; the manager backend exposes its API without OIDC. MowsProvider still
// requires an `oidc` block to construct an inert AuthProvider — the resulting
// auth context is never read in this app. Override via VITE_OIDC_ISSUER /
// VITE_OIDC_CLIENT_ID once the manager gains real auth.
const oidcIssuerUrl = import.meta.env.VITE_OIDC_ISSUER ?? `https://example.invalid`;
const oidcClientId = import.meta.env.VITE_OIDC_CLIENT_ID ?? `mows-manager`;

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <MowsProvider
        storagePrefix={`mows-manager`}
        oidc={{
            issuerUrl: oidcIssuerUrl,
            clientId: oidcClientId
        }}
        defaultThemeId={`dark`}
        languages={languages}
        initialTranslation={enInitial}
    >
        <App />
        <Toaster richColors closeButton position={`bottom-right`} />
    </MowsProvider>
);
