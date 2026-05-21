import type { MowsCodeTheme } from "@/lib/codeThemes";
import { defaultCodeThemes } from "@/lib/codeThemes";
import { describe, expect, it } from "vitest";
import { buildXtermThemeFromCodeTheme, pickColor, stripHexAlpha } from "./xtermTheme";

const FALLBACKS = {
    background: `rgb(255, 0, 255)`,
    foreground: `rgb(255, 255, 0)`,
    selection: `rgb(0, 255, 255)`
};

describe(`stripHexAlpha`, () => {
    it(`drops the alpha bytes from #rrggbbaa`, () => {
        expect(stripHexAlpha(`#67769660`)).toBe(`#677696`);
    });

    it(`leaves 6-char hex untouched`, () => {
        expect(stripHexAlpha(`#1e1e1e`)).toBe(`#1e1e1e`);
    });

    it(`leaves non-hex values untouched`, () => {
        expect(stripHexAlpha(`rgb(1,2,3)`)).toBe(`rgb(1,2,3)`);
    });
});

describe(`pickColor`, () => {
    it(`returns the first key that resolves`, () => {
        expect(
            pickColor({ "terminal.background": `#111111`, "editor.background": `#222222` },
                [`terminal.background`, `editor.background`], `#fff`)
        ).toBe(`#111111`);
    });

    it(`falls through to the next key when the first is missing`, () => {
        expect(
            pickColor({ "editor.background": `#222222` },
                [`terminal.background`, `editor.background`], `#fff`)
        ).toBe(`#222222`);
    });

    it(`returns the fallback when no key resolves and colors are undefined`, () => {
        expect(pickColor(undefined, [`terminal.background`], `#fff`)).toBe(`#fff`);
    });

    it(`strips the alpha channel from picked values`, () => {
        expect(
            pickColor({ "editor.selectionBackground": `#67769660` },
                [`editor.selectionBackground`], `#fff`)
        ).toBe(`#677696`);
    });
});

describe(`buildXtermThemeFromCodeTheme`, () => {
    const oneDarkNx = defaultCodeThemes.find((t) => t.id === `one-dark-nx`) as MowsCodeTheme;

    it(`maps One Dark NX's terminal.* keys onto the xterm theme`, () => {
        const theme = buildXtermThemeFromCodeTheme(oneDarkNx, FALLBACKS);
        // From oneDarkNx.json — these are the exact values shipped in the
        // bundled theme. If the JSON changes, update the assertions; the
        // intent is to verify the builder is reading the right keys.
        expect(theme.background).toBe(`#282c34`);
        expect(theme.foreground).toBe(`#c8c8c8`);
        expect(theme.red).toBe(`#cd3131`);
        expect(theme.green).toBe(`#0dbc79`);
        expect(theme.brightBlue).toBe(`#3b8eea`);
    });

    it(`prefers terminal.background over editor.background`, () => {
        const theme = buildXtermThemeFromCodeTheme(
            {
                id: `t`,
                name: `t`,
                monacoThemeId: `t`,
                mode: `dark`,
                colors: {
                    "terminal.background": `#111111`,
                    "editor.background": `#222222`
                }
            },
            FALLBACKS
        );
        expect(theme.background).toBe(`#111111`);
    });

    it(`falls back to editor.background when terminal.background is missing`, () => {
        const theme = buildXtermThemeFromCodeTheme(
            {
                id: `t`,
                name: `t`,
                monacoThemeId: `t`,
                mode: `dark`,
                colors: { "editor.background": `#222222` }
            },
            FALLBACKS
        );
        expect(theme.background).toBe(`#222222`);
    });

    it(`uses the workbench-theme fallbacks when the code theme ships no colors`, () => {
        const theme = buildXtermThemeFromCodeTheme(
            { id: `t`, name: `t`, monacoThemeId: `t`, mode: `dark` },
            FALLBACKS
        );
        expect(theme.background).toBe(FALLBACKS.background);
        expect(theme.foreground).toBe(FALLBACKS.foreground);
        expect(theme.selectionBackground).toBe(FALLBACKS.selection);
        expect(theme.red).toBeUndefined();
    });
});
