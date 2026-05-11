import ReactDOM from "react-dom/client";
import "../lib/main.css";
import { MowsProvider } from "../lib/lib/mowsContext/MowsContext";
import App from "./App";
import { exampleActions, exampleDefaultHotkeys } from "./exampleActions";
import { languages, type Translation } from "./languages";
import deTranslation from "./languages/de";
import enTranslation from "./languages/en-US";
import "./main.css";

const STORAGE_PREFIX = `mows-example`;

const eagerTranslations: Record<string, Translation> = {
    "en-US": enTranslation,
    de: deTranslation
};

const pickInitialTranslation = (): Translation => {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}_language`);
    if (stored && eagerTranslations[stored]) return eagerTranslations[stored];

    const browser = navigator.language;
    if (eagerTranslations[browser]) return eagerTranslations[browser];

    const browserBase = browser.split(`-`)[0];
    if (eagerTranslations[browserBase]) return eagerTranslations[browserBase];

    return enTranslation;
};

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <MowsProvider
        storagePrefix={STORAGE_PREFIX}
        oidc={{
            issuerUrl: `https://example.invalid`,
            clientId: `mows-example`
        }}
        languages={languages}
        initialTranslation={pickInitialTranslation()}
        extraActions={exampleActions}
        extraDefaultHotkeys={exampleDefaultHotkeys}
    >
        <App />
    </MowsProvider>
);
