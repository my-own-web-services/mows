import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import baseEn from "../../../lib/languages/en-US/default";
import { MowsContext, type MowsContextType } from "../../../lib/mowsContext/MowsContext";
import KeyComboDisplay from "./KeyComboDisplay";

const mowsContext = { t: baseEn } as unknown as MowsContextType;

const renderCombo = (combo: string) =>
    render(
        <MowsContext.Provider value={mowsContext}>
            <KeyComboDisplay keyCombo={combo} />
        </MowsContext.Provider>
    );

describe(`KeyComboDisplay`, () => {
    it(`renders each segment in its own <kbd>`, () => {
        const { container } = renderCombo(`mod+shift+p`);
        const kbds = container.querySelectorAll(`kbd`);
        expect(kbds.length).toBe(3);
    });

    it(`renders alphabetic keys uppercased`, () => {
        const { container } = renderCombo(`k`);
        const kbd = container.querySelector(`kbd`);
        expect(kbd?.textContent?.trim()).toBe(`K`);
    });

    it(`renders modifiers as translated words on non-Mac (default jsdom platform)`, () => {
        const { container } = renderCombo(`ctrl`);
        const kbd = container.querySelector(`kbd`);
        expect(kbd?.textContent).toMatch(/Ctrl/i);
    });

    it(`renders an icon for universal-icon keys (e.g. enter → arrow-return)`, () => {
        const { container } = renderCombo(`enter`);
        const svg = container.querySelector(`kbd svg`);
        expect(svg).not.toBeNull();
    });

    it(`renders arrowup as an icon, not text`, () => {
        const { container } = renderCombo(`arrowup`);
        const svg = container.querySelector(`kbd svg`);
        expect(svg).not.toBeNull();
    });

    it(`splits compound combos with a "+" separator between kbds`, () => {
        const { container } = renderCombo(`mod+k`);
        expect(container.textContent).toMatch(/\+/);
    });

    it(`renders escape as a translated word`, () => {
        const { container } = renderCombo(`escape`);
        expect(container.textContent?.toLowerCase()).toMatch(/esc/);
    });
});
