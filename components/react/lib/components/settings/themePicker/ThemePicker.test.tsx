import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import baseEn from "../../../lib/languages/en-US/default";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import type { MowsTheme } from "../../../lib/themes";
import ThemePicker from "./ThemePicker";

const THEMES: MowsTheme[] = [
    { id: `light`, name: `Light` },
    { id: `dark`, name: `Dark` },
    { id: `system`, name: `System` }
];

const buildContext = (setTheme = vi.fn()): MowsContextType => {
    const am = new ActionManager({ recentActionsStorageKey: `t`, maxRecentActions: 5 });
    const hm = new HotkeyManager(am, { configStorageKey: `t-hk`, defaultHotkeys: {} });
    return {

        auth: {} as never,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme,
        currentTheme: THEMES[0]!,
        setLanguage: () => undefined,
        t: baseEn,
        currentLanguage: undefined,
        themes: THEMES,
        languages: [],
        actionManager: am,
        hotkeyManager: hm,
        currentlyOpenModal: undefined,
        changeActiveModal: () => undefined,
        codeThemes: defaultCodeThemes,
        currentCodeTheme: defaultCodeThemes[0],
        setCodeTheme: () => undefined,
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        toastSettings: defaultToastSettings,
        setToastSettings: () => undefined
    } as unknown as MowsContextType;
};

describe(`ThemePicker`, () => {
    let originalMatchMedia: typeof window.matchMedia;
    beforeEach(() => {
        originalMatchMedia = window.matchMedia;
        window.matchMedia = ((query: string) => ({
            matches: false,
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            onchange: null,
            dispatchEvent: () => false
        })) as unknown as typeof window.matchMedia;
    });
    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    it(`lists every theme in standalone mode`, () => {
        render(
            <MowsContext.Provider value={buildContext()}>
                <ThemePicker standalone />
            </MowsContext.Provider>
        );
        expect(screen.getByText(`Light`)).toBeInTheDocument();
        expect(screen.getByText(`Dark`)).toBeInTheDocument();
        expect(screen.getByText(`System`)).toBeInTheDocument();
    });

    it(`fires setTheme on the surrounding context when a theme is picked`, async () => {
        const user = userEvent.setup();
        const setTheme = vi.fn();
        render(
            <MowsContext.Provider value={buildContext(setTheme)}>
                <ThemePicker standalone />
            </MowsContext.Provider>
        );
        await user.click(screen.getByText(`Dark`));
        expect(setTheme).toHaveBeenCalledWith(THEMES[1]);
    });

    it(`renders the popover trigger with the current theme by default`, () => {
        render(
            <MowsContext.Provider value={buildContext()}>
                <ThemePicker />
            </MowsContext.Provider>
        );
        const trigger = screen.getByTitle(baseEn.themePicker.selectTheme);
        expect(trigger).toHaveTextContent(`Light`);
    });
});
