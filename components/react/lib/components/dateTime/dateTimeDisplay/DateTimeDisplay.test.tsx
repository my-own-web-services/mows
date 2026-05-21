import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import enTranslation from "../../../lib/languages/en-US/default";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import DateTimeDisplay from "./DateTimeDisplay";

const buildContext = (): MowsContextType => {
    const actionManager = new ActionManager({
        recentActionsStorageKey: `test_recent_${Math.random()}`,
        maxRecentActions: 5
    });
    const hotkeyManager = new HotkeyManager(actionManager, {
        configStorageKey: `test_hk_${Math.random()}`,
        defaultHotkeys: {}
    });

    return {
        auth: {} as any,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        toastSettings: defaultToastSettings,
        setToastSettings: () => undefined,
        t: enTranslation,
        currentLanguage: undefined,
        themes: [],
        languages: [],
        actionManager,
        hotkeyManager,
        currentlyOpenModal: undefined,
        changeActiveModal: () => undefined,
        codeThemes: defaultCodeThemes,
        currentCodeTheme: defaultCodeThemes[0],
        setCodeTheme: () => undefined
    };
};

const renderWithCtx = (ui: ReactNode) =>
    render(
        <MowsContext.Provider value={buildContext()}>{ui}</MowsContext.Provider>
    );

describe(`DateTimeDisplay`, () => {
    // Regression: previously called `new Intl.DateTimeDisplayFormat(...)`
    // which is not a real API and threw `TypeError: Intl.DateTimeDisplayFormat
    // is not a constructor` on first render, blanking the whole demo page.
    it(`renders a formatted timestamp without throwing`, () => {
        const { container } = renderWithCtx(
            <DateTimeDisplay timestampMilliseconds={Date.UTC(2026, 0, 15, 9, 30, 0)} />
        );
        const out = container.querySelector(`.DateTimeDisplay`)?.textContent ?? ``;
        // Output is locale/timezone dependent — assert only that
        // `Intl.DateTimeFormat` produced a non-empty result containing the
        // year, which is enough to prove the constructor didn't throw.
        expect(out).toMatch(/2026/);
    });

    it(`renders a naive UTC datetime when utcTime is set`, () => {
        const { container } = renderWithCtx(
            <DateTimeDisplay dateTimeNaive={`2026-01-15 09:30:00`} utcTime />
        );
        expect(container.querySelector(`.DateTimeDisplay`)?.textContent).toMatch(/2026/);
    });
});
