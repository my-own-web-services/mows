import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { defaultCodeThemes, type MowsCodeTheme } from "../../../lib/codeThemes";
import enTranslation from "../../../lib/languages/en-US/default";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import CodeThemePicker from "./CodeThemePicker";

const buildContext = (
    setCodeTheme: (theme: MowsCodeTheme) => void = () => undefined,
    currentCodeThemeId = `vs-dark`
): MowsContextType => {
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
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        t: enTranslation,
        currentLanguage: undefined,
        themes: [],
        languages: [],
        actionManager,
        hotkeyManager,
        currentlyOpenModal: undefined,
        changeActiveModal: () => undefined,
        codeThemes: defaultCodeThemes,
        currentCodeTheme:
            defaultCodeThemes.find((c) => c.id === currentCodeThemeId) ?? defaultCodeThemes[0],
        setCodeTheme
    };
};

const renderWithCtx = (
    ui: ReactNode,
    setCodeTheme?: (theme: MowsCodeTheme) => void,
    currentCodeThemeId?: string
) =>
    render(
        <MowsContext.Provider value={buildContext(setCodeTheme, currentCodeThemeId)}>
            {ui}
        </MowsContext.Provider>
    );

describe(`CodeThemePicker`, () => {
    it(`shows the current code theme name`, () => {
        renderWithCtx(<CodeThemePicker />);
        expect(screen.getByText(`VS Dark`)).toBeInTheDocument();
    });

    it(`lists all theme options when opened (standalone)`, () => {
        renderWithCtx(<CodeThemePicker standalone defaultOpen />);
        expect(screen.getByText(`VS Dark`)).toBeInTheDocument();
        expect(screen.getByText(`VS Light`)).toBeInTheDocument();
        expect(screen.getByText(`High Contrast Dark`)).toBeInTheDocument();
        expect(screen.getByText(`High Contrast Light`)).toBeInTheDocument();
    });

    it(`calls setCodeTheme with the selected theme`, async () => {
        const setCodeTheme = vi.fn();
        const user = userEvent.setup();
        renderWithCtx(<CodeThemePicker standalone defaultOpen />, setCodeTheme);

        await user.click(screen.getByText(`High Contrast Dark`));

        expect(setCodeTheme).toHaveBeenCalledTimes(1);
        expect(setCodeTheme.mock.calls[0][0].id).toBe(`hc-black`);
    });

    it(`filters themes by search`, async () => {
        const user = userEvent.setup();
        renderWithCtx(<CodeThemePicker standalone defaultOpen />);

        const input = screen.getByPlaceholderText(/select code theme/i);
        await user.type(input, `high`);

        expect(screen.getByText(`High Contrast Dark`)).toBeInTheDocument();
        expect(screen.queryByText(`VS Dark`)).not.toBeInTheDocument();
    });
});
