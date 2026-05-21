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

// Bracket pair definitions per language id. These feed Monaco's
// `bracketPairColorization` feature: the colorizer walks the text and
// builds a depth-coloured bracket tree from the pairs listed here.
// Without a configuration the tree is empty and the editor option does
// nothing, which was the original "toggle exists but does nothing" bug.
//
// This data is intentionally orthogonal to token coloring — Shiki owns
// tokens (foreground colors per TextMate scope) via `setTokensProvider`,
// and `setLanguageConfiguration` does not touch tokens. The two systems
// compose cleanly: tokens stay shiki-coloured, brackets gain their
// depth tint on top.
const COMMON_CURLY_SQUARE_PAREN: monaco.languages.CharacterPair[] = [
    [`{`, `}`],
    [`[`, `]`],
    [`(`, `)`]
];
const STRUCTURED_CURLY_SQUARE: monaco.languages.CharacterPair[] = [
    [`{`, `}`],
    [`[`, `]`]
];

export const LANGUAGE_BRACKETS: Readonly<
    Record<(typeof SHIKI_LANG_IDS)[number], readonly monaco.languages.CharacterPair[]>
> = {
    tsx: COMMON_CURLY_SQUARE_PAREN,
    jsx: COMMON_CURLY_SQUARE_PAREN,
    typescript: COMMON_CURLY_SQUARE_PAREN,
    javascript: COMMON_CURLY_SQUARE_PAREN,
    // JSON / YAML have no call expressions, so `()` is never balanced
    // syntax — listing it would colour incidental parens inside string
    // values, which is the opposite of what the user expects.
    json: STRUCTURED_CURLY_SQUARE,
    yaml: STRUCTURED_CURLY_SQUARE
};

let monacoWired = false;
let monacoReadyPromise: Promise<void> | null = null;

/**
 * Idempotent. Awaits the shiki highlighter, registers `tsx` / `jsx` /
 * etc. as Monaco language ids (with bracket configuration so
 * `bracketPairColorization` has something to colour), then plugs the
 * highlighter in as Monaco's tokens provider. Subsequent calls return
 * the same resolved promise.
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
            if (!existing.has(id)) {
                m.languages.register({ id });
            }
            // Always (re-)apply our bracket configuration, even for
            // languages Monaco may have registered already. Monaco's
            // built-in TS/JS/JSON contributions already declare bracket
            // pairs that match ours, so overwriting is a no-op visually,
            // but the explicit call removes the dependency on which
            // contributions happen to be loaded.
            m.languages.setLanguageConfiguration(id, {
                brackets: LANGUAGE_BRACKETS[id] as monaco.languages.CharacterPair[]
            });
        }
        shikiToMonaco(hl, m);
    })();
    return monacoReadyPromise;
};
