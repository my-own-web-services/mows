// Standalone shiki highlighter — no `monaco-editor` import, so eager
// callers (e.g. `CodeViewer.tsx`, which is loaded ahead of the lazy
// `MonacoCodeEditor` chunk) can kick off the slow grammar / engine
// imports without dragging Monaco into their bundle.

import { createHighlighterCore, type HighlighterGeneric } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import oneDarkNxRaw from "../../../lib/codeThemes/oneDarkNx.json";
import lightPlusRaw from "@shikijs/themes/light-plus";
import darkPlusRaw from "@shikijs/themes/dark-plus";
import githubLightHcRaw from "@shikijs/themes/github-light-high-contrast";
import githubDarkHcRaw from "@shikijs/themes/github-dark-high-contrast";
import { defaultCodeThemes } from "../../../lib/codeThemes";

// Single source of truth for "which themes the editor knows how to render".
// Every monacoThemeId that can appear on `MowsContext.currentCodeTheme`
// MUST exist in this list — otherwise the shiki+monaco bridge replaces
// Monaco's `setTheme` with one that throws "Theme `X` not found", and a
// stale localStorage value brings down the whole site on reload.
//
// `assertThemesMatchDefaults` below verifies this invariant at module
// init in dev builds (and in tests). `MonacoCodeEditor` adds a runtime
// fallback so even an unknown id can't crash the editor.
export const SHIKI_THEME_NAME = `one-dark-nx`;

export const SHIKI_THEME_IDS = [
    `one-dark-nx`,
    `vs`,
    `vs-dark`,
    `hc-light`,
    `hc-black`
] as const;

export type SupportedThemeId = (typeof SHIKI_THEME_IDS)[number];

const SUPPORTED_THEME_ID_SET: ReadonlySet<string> = new Set(SHIKI_THEME_IDS);

export const isSupportedThemeId = (id: string): id is SupportedThemeId =>
    SUPPORTED_THEME_ID_SET.has(id);

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

// Register one shiki theme under a Monaco-facing name. Each entry pairs
// a Monaco theme id (the value `MonacoCodeEditor` passes to `theme={…}`)
// with the shiki theme JSON used to colorize tokens for it.
//
// The aliases below are deliberate: `vs` / `vs-dark` / `hc-light` /
// `hc-black` are the four built-in Monaco theme ids — picking any of
// them in `<CodeThemePicker>` MUST work, because once shikiToMonaco
// hijacks `monaco.editor.setTheme`, only theme names registered HERE
// resolve. The shiki bodies we alias to are the closest semantic
// equivalents from `@shikijs/themes`:
//   - vs / hc-light → light-plus / github-light-high-contrast
//   - vs-dark / hc-black → dark-plus / github-dark-high-contrast
const aliasTheme = (raw: unknown, name: SupportedThemeId): RawTheme =>
    sanitizeTheme({ ...(raw as RawTheme), name });

const THEME_INPUTS: ReadonlyArray<RawTheme> = [
    aliasTheme(oneDarkNxRaw, `one-dark-nx`),
    aliasTheme(lightPlusRaw, `vs`),
    aliasTheme(darkPlusRaw, `vs-dark`),
    aliasTheme(githubLightHcRaw, `hc-light`),
    aliasTheme(githubDarkHcRaw, `hc-black`)
];

// Dev/test guard: catch the case where someone adds a theme to
// `defaultCodeThemes` without registering its `monacoThemeId` here.
// Without this, the only signal is a runtime crash on reload after the
// user picks the new theme — far too late.
const assertThemesMatchDefaults = (): void => {
    const registered = new Set(THEME_INPUTS.map((t) => t.name));
    const missing = defaultCodeThemes
        .map((t) => t.monacoThemeId)
        .filter((id) => !registered.has(id));
    if (missing.length > 0) {
        throw new Error(
            `[shikiHighlighter] defaultCodeThemes lists monacoThemeId(s) ` +
                `not registered with shiki: ${missing.join(`, `)}. ` +
                `Add a theme alias in shikiHighlighter.ts or remove the ` +
                `entry from defaultCodeThemes — otherwise picking that ` +
                `theme breaks the editor with "Theme not found".`
        );
    }
};
assertThemesMatchDefaults();

let highlighterPromise: Promise<HighlighterGeneric<string, string>> | null = null;

/**
 * Returns a resolved (or in-flight) shiki highlighter. First call
 * triggers the lang/theme imports + engine creation; subsequent calls
 * share the same promise.
 */
export const getShikiHighlighter = (): Promise<HighlighterGeneric<string, string>> => {
    if (highlighterPromise) return highlighterPromise;
    highlighterPromise = createHighlighterCore({
        themes: THEME_INPUTS as never[],
        langs: Object.values(LANG_LOADERS) as never[],
        engine: createJavaScriptRegexEngine()
    }) as Promise<HighlighterGeneric<string, string>>;
    return highlighterPromise;
};

export const SHIKI_LANG_IDS = SHIKI_LANGS;
