import ReactDOM from "react-dom/client";
import "../lib/main.css";
import { MowsProvider } from "../lib/lib/mowsContext/MowsContext";
import App from "./App";
import { exampleActions, exampleDefaultHotkeys } from "./exampleActions";
import { languages, type Translation } from "./languages";
import "./main.css";

const STORAGE_PREFIX = `mows-example`;
const SELECTED_LANGUAGE_KEY = `${STORAGE_PREFIX}_language`;

type SupportedLocale = "en-US" | "de";

const pickInitialLocale = (): SupportedLocale => {
    const stored = localStorage.getItem(SELECTED_LANGUAGE_KEY);
    if (stored === `de` || stored === `en-US`) return stored;
    const browser = navigator.language;
    if (browser === `de` || browser.startsWith(`de-`)) return `de`;
    return `en-US`;
};

const loadInitialTranslation = async (): Promise<Translation> => {
    const locale = pickInitialLocale();
    // Static literal imports — Vite emits one chunk per branch.
    if (locale === `de`) return (await import(`./languages/de`)).default;
    return (await import(`./languages/en-US`)).default;
};

loadInitialTranslation().then((initialTranslation) => {
    ReactDOM.createRoot(document.getElementById(`root`)!).render(
        <MowsProvider
            storagePrefix={STORAGE_PREFIX}
            languages={languages}
            initialTranslation={initialTranslation}
            extraActions={exampleActions}
            extraDefaultHotkeys={exampleDefaultHotkeys}
        >
            <App />
        </MowsProvider>
    );
});
