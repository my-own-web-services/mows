/**
 * Code editor themes (Monaco-backed).
 *
 * The CodeViewer is implemented over `monaco-editor`. Monaco ships with a
 * fixed set of built-in themes whose CSS rules are part of the static
 * stylesheet — these themes work under strict CSP `style-src 'self'` without
 * needing nonces or runtime style injection. Adding more themes would
 * require `monaco.editor.defineTheme()` which generates `<style>` tags at
 * runtime, so we deliberately ship only the four built-ins.
 */

export interface MowsCodeTheme {
    readonly id: string;
    readonly name: string;
    /** Monaco theme identifier passed to `<Editor theme={...}>`. */
    readonly monacoThemeId: `vs` | `vs-dark` | `hc-black` | `hc-light`;
    /** Hint for swatches and overlays. */
    readonly mode: `dark` | `light`;
}

export const defaultCodeThemes: MowsCodeTheme[] = [
    { id: `vs-dark`, name: `VS Dark`, monacoThemeId: `vs-dark`, mode: `dark` },
    { id: `vs-light`, name: `VS Light`, monacoThemeId: `vs`, mode: `light` },
    {
        id: `hc-black`,
        name: `High Contrast Dark`,
        monacoThemeId: `hc-black`,
        mode: `dark`
    },
    {
        id: `hc-light`,
        name: `High Contrast Light`,
        monacoThemeId: `hc-light`,
        mode: `light`
    }
];
