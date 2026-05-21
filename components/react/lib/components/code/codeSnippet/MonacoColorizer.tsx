import { useMows } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import * as monaco from "monaco-editor";
import * as React from "react";
import type { CodeSnippetProps } from "./CodeSnippet";
import type { CodeViewerLanguage } from "../codeViewer/CodeViewer";
import {
    ensureShikiMonacoReady,
    isSupportedThemeId,
    SHIKI_THEME_NAME
} from "../codeViewer/shikiBridge";

const monacoLanguageFor = (lang: CodeViewerLanguage | undefined): string => {
    switch (lang) {
        case `json`:
            return `json`;
        case `yaml`:
            return `yaml`;
        case `javascript`:
            return `javascript`;
        case `jsx`:
            return `jsx`;
        case `typescript`:
            return `typescript`;
        case `tsx`:
            return `tsx`;
        case `text`:
        case undefined:
        default:
            return `plaintext`;
    }
};

// Activate the requested theme exactly once per id. shikiToMonaco
// registers the theme via `monaco.editor.defineTheme()` under our
// canonical id (e.g. `one-dark-nx`); `setTheme` then injects the
// `.monaco-editor .mtkN { color: … }` rules that `colorize()` HTML
// relies on.
const activatedThemes = new Set<string>();

const ensureThemeStyles = (themeId: string): void => {
    if (activatedThemes.has(themeId)) return;
    monaco.editor.setTheme(themeId);
    activatedThemes.add(themeId);
};

// Module-level cache of colorize results, keyed on the same triple that
// drives the effect dependency array. Without it, every time an inline
// `<CodeSnippet>` (or block snippet) re-mounts — switching doc pages,
// scrolling a virtualized list, theme/language change — we'd pay the
// full tokenize roundtrip and the user would see a flash of plain text
// even though the exact same snippet was colorized seconds ago. The
// cache holds the resolved HTML string so subsequent mounts paint
// synchronously on the first render.
const COLORIZE_CACHE = new Map<string, string>();
const COLORIZE_INFLIGHT = new Map<string, Promise<string>>();
const colorizeKey = (code: string, lang: string, themeId: string): string =>
    `${themeId}\x1f${lang}\x1f${code}`;

// LRU cap so the cache can't grow without bound in a long-running SPA
// with many unique theme×language×code combinations (TECH-TS-22). JS Map
// iteration order is insertion order, so `next().value` yields the
// oldest key — evicting that gives us a cheap FIFO/LRU hybrid: every
// hit is a no-op (we don't re-insert on read), but every miss evicts
// the oldest entry. 500 entries is generous for docs harnesses (~120
// code snippets × a few themes) and keeps RSS bounded.
const COLORIZE_CACHE_MAX = 500;
const evictColorizeCache = (): void => {
    while (COLORIZE_CACHE.size > COLORIZE_CACHE_MAX) {
        const oldest = COLORIZE_CACHE.keys().next().value;
        if (oldest === undefined) break;
        COLORIZE_CACHE.delete(oldest);
    }
};

export { safeColorizedHtml } from "./safeColorizedHtml";
import { safeColorizedHtml } from "./safeColorizedHtml";

const colorizeCached = async (
    code: string,
    lang: string,
    themeId: string
): Promise<string> => {
    const key = colorizeKey(code, lang, themeId);
    const hit = COLORIZE_CACHE.get(key);
    if (hit !== undefined) return hit;
    const inflight = COLORIZE_INFLIGHT.get(key);
    if (inflight) return inflight;
    const promise = ensureShikiMonacoReady(monaco)
        .then(() => {
            ensureThemeStyles(themeId);
            return monaco.editor.colorize(code, lang, { tabSize: 4 });
        })
        .then((html) => {
            const safe = safeColorizedHtml(html, code);
            COLORIZE_CACHE.set(key, safe);
            evictColorizeCache();
            COLORIZE_INFLIGHT.delete(key);
            return safe;
        })
        .catch((err: unknown) => {
            COLORIZE_INFLIGHT.delete(key);
            throw err;
        });
    COLORIZE_INFLIGHT.set(key, promise);
    return promise;
};

const MonacoColorizer = (props: CodeSnippetProps) => {
    const { code, language = `text`, mode = `block`, className, style } = props;
    const ctx = useMows();
    // Mirrors the guard in MonacoCodeEditor: shikiToMonaco's wrapper
    // throws on unknown theme names, which would crash the whole
    // CodeSnippet render path. Fall back instead.
    const requestedThemeId = ctx?.currentCodeTheme?.monacoThemeId ?? SHIKI_THEME_NAME;
    const themeId = isSupportedThemeId(requestedThemeId)
        ? requestedThemeId
        : SHIKI_THEME_NAME;
    const monacoLang = monacoLanguageFor(language);
    // Inline mode collapses newlines and clips to a single visual line.
    const sanitizedCode = mode === `inline` ? code.replace(/\s+/g, ` `).trim() : code;

    // Seed initial state from the cache so re-mounted snippets paint
    // colorized HTML synchronously on first render (no plain-text flash).
    const [html, setHtml] = React.useState<string | null>(() => {
        const cached = COLORIZE_CACHE.get(
            colorizeKey(sanitizedCode, monacoLang, themeId)
        );
        return cached ?? null;
    });

    React.useEffect(() => {
        // Synchronous cache hit — no async work, no state churn.
        const cached = COLORIZE_CACHE.get(
            colorizeKey(sanitizedCode, monacoLang, themeId)
        );
        if (cached !== undefined) {
            if (html !== cached) setHtml(cached);
            return;
        }
        let cancelled = false;
        colorizeCached(sanitizedCode, monacoLang, themeId)
            .then((result) => {
                if (!cancelled) setHtml(result);
            })
            .catch(() => {
                if (!cancelled) setHtml(null);
            });
        return () => {
            cancelled = true;
        };
        // `html` deliberately omitted — we only want the effect to fire
        // when the input triple changes, not after every state update.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sanitizedCode, monacoLang, themeId]);

    // While colorize is in flight (or if it failed), render the raw code so
    // the snippet is still readable.
    const inner =
        html !== null ? (
            <span dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
            <span>{sanitizedCode}</span>
        );

    // Monaco's `.mtkN` rules are global (not scoped under `.monaco-editor`),
    // so the wrapper doesn't need that class — and avoiding it keeps Monaco's
    // injected sans-serif `.monaco-editor { font-family: ...sans-serif }`
    // rule from clobbering our monospace stack.

    if (mode === `inline`) {
        return (
            <code
                className={cn(
                    `CodeSnippet inline-block rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[0.92em]`,
                    className
                )}
                style={style}
            >
                {inner}
            </code>
        );
    }

    return (
        <pre
            className={cn(
                `CodeSnippet overflow-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm leading-relaxed`,
                className
            )}
            style={style}
        >
            {inner}
        </pre>
    );
};

MonacoColorizer.displayName = `MonacoColorizer`;

export default MonacoColorizer;
