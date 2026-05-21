import type { CodeThemeColors, MowsCodeTheme } from "@/lib/codeThemes";
import type { ITheme } from "@xterm/xterm";

// xterm.js refuses `#rrggbbaa` 8-char hex (VS Code's standard alpha form).
// Strip the trailing alpha bytes so xterm's parser accepts the value.
export const stripHexAlpha = (color: string): string =>
    /^#[0-9a-f]{8}$/i.test(color) ? color.slice(0, 7) : color;

// Look up the first VS Code theme-color key that resolves, returning the
// fallback if none of them are present. Mirrors how VS Code resolves derived
// terminal colors (e.g. `terminal.background` falls back to `editor.background`).
export const pickColor = (
    colors: CodeThemeColors | undefined,
    keys: ReadonlyArray<string>,
    fallback: string
): string => {
    if (!colors) return fallback;
    for (const k of keys) {
        const value = colors[k];
        if (value) return stripHexAlpha(value);
    }
    return fallback;
};

export interface XtermThemeFallbacks {
    readonly background: string;
    readonly foreground: string;
    readonly selection: string;
}

// Build an xterm ITheme from the active *code* theme — VS Code parity, where
// the integrated terminal inherits its colors from the editor theme
// (`terminal.*` keys first, falling back to `editor.*`). When the code theme
// ships no `colors`, the supplied fallbacks (typically resolved from the
// workbench theme's CSS vars) take over.
export const buildXtermThemeFromCodeTheme = (
    codeTheme: MowsCodeTheme | undefined,
    fallbacks: XtermThemeFallbacks
): ITheme => {
    const colors = codeTheme?.colors;
    return {
        background: pickColor(
            colors,
            [`terminal.background`, `editor.background`],
            fallbacks.background
        ),
        foreground: pickColor(
            colors,
            [`terminal.foreground`, `editor.foreground`],
            fallbacks.foreground
        ),
        cursor: pickColor(
            colors,
            [`terminalCursor.foreground`, `editorCursor.foreground`, `editor.foreground`],
            fallbacks.foreground
        ),
        cursorAccent: pickColor(
            colors,
            [`terminalCursor.background`, `editor.background`],
            fallbacks.background
        ),
        selectionBackground: pickColor(
            colors,
            [`terminal.selectionBackground`, `editor.selectionBackground`],
            fallbacks.selection
        ),
        // ANSI palette — pulled straight from the code theme when supplied.
        // xterm uses its own defaults for any slot left undefined.
        black: colors?.[`terminal.ansiBlack`],
        red: colors?.[`terminal.ansiRed`],
        green: colors?.[`terminal.ansiGreen`],
        yellow: colors?.[`terminal.ansiYellow`],
        blue: colors?.[`terminal.ansiBlue`],
        magenta: colors?.[`terminal.ansiMagenta`],
        cyan: colors?.[`terminal.ansiCyan`],
        white: colors?.[`terminal.ansiWhite`],
        brightBlack: colors?.[`terminal.ansiBrightBlack`],
        brightRed: colors?.[`terminal.ansiBrightRed`],
        brightGreen: colors?.[`terminal.ansiBrightGreen`],
        brightYellow: colors?.[`terminal.ansiBrightYellow`],
        brightBlue: colors?.[`terminal.ansiBrightBlue`],
        brightMagenta: colors?.[`terminal.ansiBrightMagenta`],
        brightCyan: colors?.[`terminal.ansiBrightCyan`],
        brightWhite: colors?.[`terminal.ansiBrightWhite`]
    };
};
