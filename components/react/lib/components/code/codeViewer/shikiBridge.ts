// Monaco-wiring layer for shiki. The heavyweight highlighter creation
// (oniguruma replacement engine + grammar imports + theme conversion)
// lives in `shikiHighlighter.ts`, which has NO `monaco-editor` import,
// so eager callers (`CodeViewer.tsx`, which is in the eager doc-page
// bundle) can kick the highlighter off before the lazy
// `MonacoCodeEditor` chunk even arrives. By the time the lazy chunk
// loads, the highlighter is hot and `shikiToMonaco` runs near-instantly.

import * as monaco from "monaco-editor";
import { shikiToMonaco } from "@shikijs/monaco";
import {
    getShikiHighlighter,
    isSupportedThemeId,
    SHIKI_LANG_IDS,
    SHIKI_THEME_IDS,
    SHIKI_THEME_NAME
} from "./shikiHighlighter";

export {
    getShikiHighlighter,
    isSupportedThemeId,
    SHIKI_THEME_IDS,
    SHIKI_THEME_NAME
};

let monacoWired = false;
let monacoReadyPromise: Promise<void> | null = null;

/**
 * Idempotent. Awaits the shiki highlighter, registers `tsx` / `jsx` /
 * etc. as Monaco language ids, then plugs the highlighter in as Monaco's
 * tokens provider. Subsequent calls return the same resolved promise.
 */
export const ensureShikiMonacoReady = (
    m: typeof monaco = monaco
): Promise<void> => {
    if (monacoReadyPromise) return monacoReadyPromise;
    monacoReadyPromise = (async () => {
        const hl = await getShikiHighlighter();
        if (monacoWired) return;
        monacoWired = true;
        const existing = new Set(m.languages.getLanguages().map((l) => l.id));
        for (const id of SHIKI_LANG_IDS) {
            if (existing.has(id)) continue;
            m.languages.register({ id });
        }
        shikiToMonaco(hl, m);
    })();
    return monacoReadyPromise;
};
