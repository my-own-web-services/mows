import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import baseEn from "../../../lib/languages/en-US/default";
import { Action, ActionManager, ActionVisibility } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import CommandPalette from "./CommandPalette";

const makeAction = (id: string, executeAction = vi.fn()) =>
    new Action({
        id,
        category: `test`,
        actionHandlers: new Map([
            [
                `h`,
                {
                    id: `h`,
                    scopes: [`s`],
                    getState: () => ({ visibility: ActionVisibility.Shown }),
                    executeAction
                }
            ]
        ])
    });

const buildContext = (
    actions: { id: string; execute?: ReturnType<typeof vi.fn> }[]
): MowsContextType => {
    const am = new ActionManager({ recentActionsStorageKey: `t`, maxRecentActions: 5 });
    for (const a of actions) am.defineAction(makeAction(a.id, a.execute));
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

describe(`CommandPalette`, () => {
    it(`is closed by default — no list items rendered`, () => {
        render(
            <MowsContext.Provider value={buildContext([{ id: `actionA` }])}>
                <CommandPalette />
            </MowsContext.Provider>
        );
        expect(screen.queryByText(`actionA`)).not.toBeInTheDocument();
    });

    it(`opens when the controlled open prop flips to true`, () => {
        const { rerender } = render(
            <MowsContext.Provider value={buildContext([{ id: `actionA` }])}>
                <CommandPalette open={false} onOpenChange={() => undefined} />
            </MowsContext.Provider>
        );
        expect(screen.queryByText(`actionA`)).not.toBeInTheDocument();
        rerender(
            <MowsContext.Provider value={buildContext([{ id: `actionA` }])}>
                <CommandPalette open onOpenChange={() => undefined} />
            </MowsContext.Provider>
        );
        expect(screen.getByText(`actionA`)).toBeInTheDocument();
    });

    it(`renders one row per registered action`, () => {
        render(
            <MowsContext.Provider
                value={buildContext([{ id: `a1` }, { id: `a2` }, { id: `a3` }])}
            >
                <CommandPalette open />
            </MowsContext.Provider>
        );
        expect(screen.getByText(`a1`)).toBeInTheDocument();
        expect(screen.getByText(`a2`)).toBeInTheDocument();
        expect(screen.getByText(`a3`)).toBeInTheDocument();
    });

    it(`filters the action list by the typed query`, async () => {
        const user = userEvent.setup();
        render(
            <MowsContext.Provider
                value={buildContext([{ id: `greet` }, { id: `dismiss` }])}
            >
                <CommandPalette open onOpenChange={() => undefined} />
            </MowsContext.Provider>
        );
        const input = screen.getByRole(`combobox`);
        await user.type(input, `gree`);
        expect(screen.getByText(`greet`)).toBeInTheDocument();
        expect(screen.queryByText(`dismiss`)).not.toBeInTheDocument();
    });

    it(`dispatches the action when an item is clicked`, async () => {
        const user = userEvent.setup();
        const exec = vi.fn();
        const onOpenChange = vi.fn();
        render(
            <MowsContext.Provider value={buildContext([{ id: `greet`, execute: exec }])}>
                <CommandPalette open onOpenChange={onOpenChange} />
            </MowsContext.Provider>
        );
        await user.click(screen.getByText(`greet`));
        expect(exec).toHaveBeenCalled();
    });
});
