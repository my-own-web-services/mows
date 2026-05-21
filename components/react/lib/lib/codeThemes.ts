/**
 * Code editor themes (Monaco-backed).
 *
 * The CodeViewer is implemented over `monaco-editor`. Monaco ships with
 * four built-in themes (`vs`, `vs-dark`, `hc-black`, `hc-light`). Beyond
 * those, the library bundles `One Dark NX` as a real VS Code TextMate
 * theme — the actual tokenization (and theme registration) is handled by
 * `shiki` + `@shikijs/monaco` from
 * `lib/components/code/codeViewer/shikiBridge.ts`, which feeds Monaco
 * the exact scopes VS Code emits so the theme rules apply natively.
 *
 * shiki injects a tiny `<style>` block per theme; consumers under a
 * strict `style-src 'self'` CSP should override `codeThemes` on
 * `<MowsProvider>` and stay with one of the four built-in Monaco themes.
 */

/**
 * Identifier for the bundled `One Dark NX` theme. The actual TextMate
 * grammar + theme registration is wired into Monaco lazily by
 * `shikiBridge.ts`, which is imported as a side effect only by the
 * Monaco entry points — keeping this file free of any `monaco-editor` /
 * `shiki` dependency so apps that consume MowsProvider but never render
 * code do not pull either bundle in.
 */
export const ONE_DARK_NX_THEME_ID = `one-dark-nx`;

import oneDarkNxRaw from "./codeThemes/oneDarkNx.json";

/**
 * VS Code-style theme colors map (subset of the `workbench.colorCustomizations`
 * keys). We carry it verbatim alongside each `MowsCodeTheme` so consumers like
 * the xterm-based `<Terminal>` can pull `terminal.background`, the ANSI
 * palette, etc. straight from the active code theme — just like VS Code's
 * integrated terminal does.
 */
export type CodeThemeColors = Readonly<Record<string, string>>;

export interface MowsCodeTheme {
    readonly id: string;
    readonly name: string;
    /**
     * Monaco theme identifier passed to `<Editor theme={...}>`. Any of the
     * built-in ids (`vs`, `vs-dark`, `hc-black`, `hc-light`) or a custom id
     * registered via `monaco.editor.defineTheme()`.
     */
    readonly monacoThemeId: string;
    /** Hint for swatches and overlays. */
    readonly mode: `dark` | `light`;
    /**
     * VS Code-style theme color map. Optional — when present, surfaces that
     * want to follow the editor theme (xterm-based terminal, etc.) read
     * `editor.background`, `terminal.foreground`, `terminal.ansi*`, etc.
     * directly. When absent, those surfaces fall back to the project theme.
     */
    readonly colors?: CodeThemeColors;
}

// Built-in Monaco themes have no JSON we can pull from, so we hand-curate a
// minimal palette matching VS Code's same-named built-ins. Each entry covers
// the keys our terminal consumes: editor.background/foreground (used as the
// chrome around the canvas), terminal.foreground, terminal.selectionBackground,
// editorCursor.foreground, and the 16 ANSI slots. ANSI values mirror VS Code's
// default light/dark palettes — same hex codes the upstream themes ship.
const VS_DARK_COLORS: CodeThemeColors = {
    "editor.background": `#1e1e1e`,
    "editor.foreground": `#d4d4d4`,
    "editor.selectionBackground": `#264f78`,
    "editorCursor.foreground": `#aeafad`,
    "terminal.background": `#1e1e1e`,
    "terminal.foreground": `#cccccc`,
    "terminal.ansiBlack": `#000000`,
    "terminal.ansiRed": `#cd3131`,
    "terminal.ansiGreen": `#0dbc79`,
    "terminal.ansiYellow": `#e5e510`,
    "terminal.ansiBlue": `#2472c8`,
    "terminal.ansiMagenta": `#bc3fbc`,
    "terminal.ansiCyan": `#11a8cd`,
    "terminal.ansiWhite": `#e5e5e5`,
    "terminal.ansiBrightBlack": `#666666`,
    "terminal.ansiBrightRed": `#f14c4c`,
    "terminal.ansiBrightGreen": `#23d18b`,
    "terminal.ansiBrightYellow": `#f5f543`,
    "terminal.ansiBrightBlue": `#3b8eea`,
    "terminal.ansiBrightMagenta": `#d670d6`,
    "terminal.ansiBrightCyan": `#29b8db`,
    "terminal.ansiBrightWhite": `#e5e5e5`
};

const VS_LIGHT_COLORS: CodeThemeColors = {
    "editor.background": `#ffffff`,
    "editor.foreground": `#000000`,
    "editor.selectionBackground": `#add6ff`,
    "editorCursor.foreground": `#000000`,
    "terminal.background": `#ffffff`,
    "terminal.foreground": `#333333`,
    "terminal.ansiBlack": `#000000`,
    "terminal.ansiRed": `#cd3131`,
    "terminal.ansiGreen": `#107c10`,
    "terminal.ansiYellow": `#949800`,
    "terminal.ansiBlue": `#0451a5`,
    "terminal.ansiMagenta": `#bc05bc`,
    "terminal.ansiCyan": `#0598bc`,
    "terminal.ansiWhite": `#555555`,
    "terminal.ansiBrightBlack": `#666666`,
    "terminal.ansiBrightRed": `#cd3131`,
    "terminal.ansiBrightGreen": `#14ce14`,
    "terminal.ansiBrightYellow": `#b5ba00`,
    "terminal.ansiBrightBlue": `#0451a5`,
    "terminal.ansiBrightMagenta": `#bc05bc`,
    "terminal.ansiBrightCyan": `#0598bc`,
    "terminal.ansiBrightWhite": `#a5a5a5`
};

const HC_BLACK_COLORS: CodeThemeColors = {
    "editor.background": `#000000`,
    "editor.foreground": `#ffffff`,
    "editor.selectionBackground": `#ffffff`,
    "editorCursor.foreground": `#ffffff`,
    "terminal.background": `#000000`,
    "terminal.foreground": `#ffffff`
};

const HC_LIGHT_COLORS: CodeThemeColors = {
    "editor.background": `#ffffff`,
    "editor.foreground": `#292929`,
    "editor.selectionBackground": `#0f4a85`,
    "editorCursor.foreground": `#292929`,
    "terminal.background": `#ffffff`,
    "terminal.foreground": `#292929`
};

export const defaultCodeThemes: MowsCodeTheme[] = [
    {
        id: ONE_DARK_NX_THEME_ID,
        name: `One Dark NX`,
        monacoThemeId: ONE_DARK_NX_THEME_ID,
        mode: `dark`,
        colors: (oneDarkNxRaw as { colors?: CodeThemeColors }).colors
    },
    {
        id: `vs-dark`,
        name: `VS Dark`,
        monacoThemeId: `vs-dark`,
        mode: `dark`,
        colors: VS_DARK_COLORS
    },
    {
        id: `vs-light`,
        name: `VS Light`,
        monacoThemeId: `vs`,
        mode: `light`,
        colors: VS_LIGHT_COLORS
    },
    {
        id: `hc-black`,
        name: `High Contrast Dark`,
        monacoThemeId: `hc-black`,
        mode: `dark`,
        colors: HC_BLACK_COLORS
    },
    {
        id: `hc-light`,
        name: `High Contrast Light`,
        monacoThemeId: `hc-light`,
        mode: `light`,
        colors: HC_LIGHT_COLORS
    }
];
