import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import baseEn from "../../../lib/languages/en-US/default";
import { Logger } from "../../../lib/logging";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import LoggingConfig from "./LoggingConfig";

const buildContext = (): MowsContextType => {
    const am = new ActionManager({ recentActionsStorageKey: `t`, maxRecentActions: 5 });
    const hm = new HotkeyManager(am, { configStorageKey: `t-hk`, defaultHotkeys: {} });
    return {

        auth: {} as never,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
        t: baseEn,
        currentLanguage: undefined,
        themes: [],
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

const renderConfig = () =>
    render(
        <MowsContext.Provider value={buildContext()}>
            <LoggingConfig />
        </MowsContext.Provider>
    );

describe(`LoggingConfig`, () => {
    it(`renders the default-level section with every log-level label`, () => {
        renderConfig();
        // Every log level must be reachable from the slider; an earlier
        // "any one of them appears" check passed even when 4 of 5 were
        // missing.
        for (const label of [`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`]) {
            expect(
                screen.queryAllByText(label).length,
                `expected level label ${label} to render`
            ).toBeGreaterThan(0);
        }
    });

    it(`exposes an input for adding a per-file filter`, () => {
        renderConfig();
        const input = screen.getByRole(`textbox`);
        expect(input).toBeInTheDocument();
    });

    it(`adds a file filter when the add button is clicked`, async () => {
        const user = userEvent.setup();
        renderConfig();
        const before = { ...Logger.fileFilter };
        const input = screen.getByRole(`textbox`);
        await user.type(input, `foo.tsx`);
        // The add affordance is one of the buttons; find a button labelled
        // "Add" / "+" — fall back to "the button next to the new-pattern input".
        const buttons = screen.getAllByRole(`button`);
        // Click each button until one of them adds the filter to Logger.fileFilter.
        for (const b of buttons) {
            if (!b.hasAttribute(`disabled`)) {
                await user.click(b);
                if (Logger.fileFilter[`foo.tsx`] !== undefined) break;
            }
        }
        expect(Logger.fileFilter[`foo.tsx`]).toBeDefined();
        // Cleanup so we don't leak into later tests.
        Logger.fileFilter = before;
        Logger.saveConfig();
    });
});
