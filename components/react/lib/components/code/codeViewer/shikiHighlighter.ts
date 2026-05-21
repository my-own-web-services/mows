// Standalone shiki highlighter — no `monaco-editor` import, so eager
// callers (e.g. `CodeViewer.tsx`, which is loaded ahead of the lazy
// `MonacoCodeEditor` chunk) can kick off the slow grammar / engine
// imports without dragging Monaco into their bundle.

import { createHighlighterCore, type HighlighterGeneric } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import oneDarkNxRaw from "../../../lib/codeThemes/oneDarkNx.json";

export const SHIKI_THEME_NAME = `one-dark-nx`;

// Trimmed list — only the languages `CodeViewer` / `CodeSnippet` accept.
// Loading fewer grammars cuts first-paint cold-start.
const SHIKI_LANGS = [
    `tsx`,
    `jsx`,
    `typescript`,
    `javascript`,
    `json`,
    `yaml`
] as const;

// Lazy grammar loaders — each is a dynamic import that vite splits into
// its own chunk so the first paint only pays for the languages it
// actually renders.
const LANG_LOADERS = {
    tsx: () => import(`@shikijs/langs/tsx`),
    jsx: () => import(`@shikijs/langs/jsx`),
    typescript: () => import(`@shikijs/langs/typescript`),
    javascript: () => import(`@shikijs/langs/javascript`),
    json: () => import(`@shikijs/langs/json`),
    yaml: () => import(`@shikijs/langs/yaml`)
} satisfies Record<(typeof SHIKI_LANGS)[number], () => Promise<unknown>>;

interface TokenColorEntry {
    readonly scope?: string | readonly string[];
    readonly settings?: {
        readonly foreground?: string;
        readonly background?: string;
        readonly fontStyle?: string;
    };
}

interface RawTheme {
    readonly name?: string;
    readonly type?: string;
    readonly colors?: Record<string, string>;
    readonly tokenColors?: readonly TokenColorEntry[];
}

// Drop rules with no `foreground` (TextMate fontStyle-only rules render
// as black under shiki+monaco) and ensure `editor.foreground` is set so
// `monaco.editor.colorize()` doesn't emit unstyled plaintext.
const sanitizeTheme = (raw: RawTheme): RawTheme => {
    const tokenColors = (raw.tokenColors ?? []).filter((tc) => {
        const s = tc.settings;
        if (!s) return false;
        const hasFg = !!s.foreground && s.foreground.trim() !== ``;
        const hasBg = !!s.background && s.background.trim() !== ``;
        return hasFg || hasBg;
    });
    const colors = { ...(raw.colors ?? {}) };
    if (!colors[`editor.foreground`]) {
        colors[`editor.foreground`] =
            raw.type === `light` ? `#383a42` : `#d7dae0`;
    }
    return { ...raw, colors, tokenColors };
};

let highlighterPromise: Promise<HighlighterGeneric<string, string>> | null = null;

/**
 * Returns a resolved (or in-flight) shiki highlighter. First call
 * triggers the lang/theme imports + engine creation; subsequent calls
 * share the same promise.
 */
export const getShikiHighlighter = (): Promise<HighlighterGeneric<string, string>> => {
    if (highlighterPromise) return highlighterPromise;
    const themeInput = sanitizeTheme({
        ...(oneDarkNxRaw as RawTheme),
        name: SHIKI_THEME_NAME
    });
    highlighterPromise = createHighlighterCore({
        themes: [themeInput as never],
        langs: Object.values(LANG_LOADERS) as never[],
        engine: createJavaScriptRegexEngine()
    }) as Promise<HighlighterGeneric<string, string>>;
    return highlighterPromise;
};

export const SHIKI_LANG_IDS = SHIKI_LANGS;
