import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import { Action, ActionManager, ActionVisibility } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import baseEn from "../../../lib/languages/en-US/default";
import ActionDisplay from "./ActionDisplay";

const buildContext = (
    actionManager: ActionManager,
    hotkeyManager: HotkeyManager,
    actionLabel?: string
): MowsContextType =>
    ({

        auth: {} as never,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
        t: actionLabel
            ? { ...baseEn, actions: { ...baseEn.actions, demoAction: actionLabel } }
            : baseEn,
        currentLanguage: undefined,
        themes: [],
        languages: [],
        actionManager,
        hotkeyManager,
        currentlyOpenModal: undefined,
        changeActiveModal: () => undefined,
        codeThemes: defaultCodeThemes,
        currentCodeTheme: defaultCodeThemes[0],
        setCodeTheme: () => undefined,
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        toastSettings: defaultToastSettings,
        setToastSettings: () => undefined
    }) as unknown as MowsContextType;

const makeAction = (id: string, opts: { iconText?: string; disabledReason?: string } = {}) =>
    new Action({
        id,
        category: `test`,
        actionHandlers: new Map([
            [
                `h`,
                {
                    id: `h`,
                    scopes: [`scope`],
                    getState: () => ({
                        visibility: ActionVisibility.Shown,
                        icon: opts.iconText ? () => <i data-testid={`icon`}>{opts.iconText}</i> : undefined,
                        disabledReasonText: opts.disabledReason
                    }),
                    executeAction: () => undefined
                }
            ]
        ])
    });

const setup = (
    label = `Demo action`,
    opts: { iconText?: string; disabledReason?: string; hotkeys?: string[] } = {}
) => {
    const am = new ActionManager({ recentActionsStorageKey: `t`, maxRecentActions: 5 });
    const action = makeAction(`demoAction`, opts);
    am.defineAction(action);
    const hm = new HotkeyManager(am, {
        configStorageKey: `t-hk`,
        defaultHotkeys: opts.hotkeys
            ? { demoAction: { keyCombinations: opts.hotkeys } }
            : {}
    });
    return { mowsContext: buildContext(am, hm, label), action };
};

describe(`ActionDisplay`, () => {
    it(`renders the action label from the translation table`, () => {
        const { mowsContext, action } = setup(`Greet`);
        render(
            <MowsContext.Provider value={mowsContext}>
                <ActionDisplay action={action} />
            </MowsContext.Provider>
        );
        expect(screen.getByText(`Greet`)).toBeInTheDocument();
    });

    it(`falls back to the action id when no translation is registered`, () => {
        const am = new ActionManager({ recentActionsStorageKey: `t`, maxRecentActions: 5 });
        const action = makeAction(`untranslated`);
        am.defineAction(action);
        const hm = new HotkeyManager(am, { configStorageKey: `t-hk`, defaultHotkeys: {} });
        const mowsContext = buildContext(am, hm);
        render(
            <MowsContext.Provider value={mowsContext}>
                <ActionDisplay action={action} />
            </MowsContext.Provider>
        );
        expect(screen.getByText(`untranslated`)).toBeInTheDocument();
    });

    it(`renders the icon returned by the action state`, () => {
        const { mowsContext, action } = setup(`Greet`, { iconText: `✋` });
        render(
            <MowsContext.Provider value={mowsContext}>
                <ActionDisplay action={action} />
            </MowsContext.Provider>
        );
        expect(screen.getByTestId(`icon`)).toBeInTheDocument();
    });

    it(`exposes disabledReasonText via the title attribute`, () => {
        const { mowsContext, action } = setup(`Greet`, { disabledReason: `needs auth` });
        const { container } = render(
            <MowsContext.Provider value={mowsContext}>
                <ActionDisplay action={action} />
            </MowsContext.Provider>
        );
        const labelled = container.querySelector(`[title="needs auth"]`);
        expect(labelled).not.toBeNull();
    });

    it(`renders one KeyComboDisplay per registered hotkey`, () => {
        const { mowsContext, action } = setup(`Greet`, { hotkeys: [`mod+k`, `alt+g`] });
        const { container } = render(
            <MowsContext.Provider value={mowsContext}>
                <ActionDisplay action={action} />
            </MowsContext.Provider>
        );
        const kbds = container.querySelectorAll(`kbd`);
        expect(kbds.length).toBeGreaterThanOrEqual(2);
    });
});
