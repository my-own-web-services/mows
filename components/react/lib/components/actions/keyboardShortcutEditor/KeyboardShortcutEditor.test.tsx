import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
import KeyboardShortcutEditor from "./KeyboardShortcutEditor";

const setupContext = (registered: { id: string; combos?: string[] }[]): MowsContextType => {
    const am = new ActionManager({ recentActionsStorageKey: `t`, maxRecentActions: 5 });
    for (const r of registered) {
        am.defineAction(
            new Action({
                id: r.id,
                category: `test`,
                actionHandlers: new Map([
                    [
                        `h`,
                        {
                            id: `h`,
                            scopes: [`s`],
                            getState: () => ({ visibility: ActionVisibility.Shown }),
                            executeAction: () => undefined
                        }
                    ]
                ])
            })
        );
    }
    const defaultHotkeys: Record<string, { keyCombinations: string[] }> = {};
    for (const r of registered) if (r.combos) defaultHotkeys[r.id] = { keyCombinations: r.combos };
    const hm = new HotkeyManager(am, { configStorageKey: `t-hk`, defaultHotkeys });
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

const renderEditor = (mowsContext: MowsContextType) =>
    render(
        <MowsContext.Provider value={mowsContext}>
            <KeyboardShortcutEditor />
        </MowsContext.Provider>
    );

describe(`KeyboardShortcutEditor`, () => {
    it(`lists every registered action`, () => {
        const mowsContext = setupContext([
            { id: `actionA`, combos: [`mod+a`] },
            { id: `actionB`, combos: [`mod+b`] }
        ]);
        renderEditor(mowsContext);
        expect(screen.getByText(`actionA`)).toBeInTheDocument();
        expect(screen.getByText(`actionB`)).toBeInTheDocument();
    });

    it(`renders the currently-bound key combos for each action`, () => {
        const mowsContext = setupContext([{ id: `act`, combos: [`mod+shift+p`] }]);
        const { container } = renderEditor(mowsContext);
        // KeyComboDisplay renders one <kbd> per segment — mod+shift+p has 3.
        const kbds = container.querySelectorAll(`kbd`);
        expect(kbds.length).toBeGreaterThanOrEqual(3);
    });

    it(`filters by the search query`, async () => {
        const user = userEvent.setup();
        const mowsContext = setupContext([
            { id: `greet`, combos: [`mod+g`] },
            { id: `submit`, combos: [`mod+enter`] }
        ]);
        renderEditor(mowsContext);
        const input = screen.getByRole(`searchbox`);
        await user.type(input, `gree`);
        expect(screen.getByText(`greet`)).toBeInTheDocument();
        expect(screen.queryByText(`submit`)).not.toBeInTheDocument();
    });

    it(`shows the empty state when no actions match`, async () => {
        const user = userEvent.setup();
        const mowsContext = setupContext([{ id: `greet`, combos: [`mod+g`] }]);
        renderEditor(mowsContext);
        await user.type(screen.getByRole(`searchbox`), `xxxxx`);
        expect(screen.queryByText(`greet`)).not.toBeInTheDocument();
    });
});
