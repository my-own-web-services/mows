import { describe, expect, it } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import { isSupportedThemeId, SHIKI_THEME_IDS } from "./shikiHighlighter";

// Hard guarantee that `defaultCodeThemes` and the shiki theme registry
// agree on the supported set. Without this, adding a code theme without
// also wiring up a shiki theme alias would compile cleanly, ship to
// users, get selected once, and brick the page on next reload with
// `ShikiError: Theme not found` (the original incident).
describe(`shiki theme registry`, () => {
    it(`registers every monacoThemeId listed in defaultCodeThemes`, () => {
        const missing = defaultCodeThemes
            .map((t) => t.monacoThemeId)
            .filter((id) => !isSupportedThemeId(id));
        expect(missing).toEqual([]);
    });

    it(`exposes "one-dark-nx" as the always-available fallback theme`, () => {
        expect(SHIKI_THEME_IDS).toContain(`one-dark-nx`);
        expect(isSupportedThemeId(`one-dark-nx`)).toBe(true);
    });

    it(`rejects unknown theme ids via the type guard`, () => {
        expect(isSupportedThemeId(`monokai`)).toBe(false);
        expect(isSupportedThemeId(``)).toBe(false);
    });
});
