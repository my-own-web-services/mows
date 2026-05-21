import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import baseEn from "../../../lib/languages/en-US/default";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { CoreModalTypes } from "../../../lib/mowsContext/coreActions";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import ModalHandler, { type ModalEntry } from "./ModalHandler";

const buildContext = (
    currentlyOpenModal: string | undefined,
    changeActiveModal = vi.fn()
): MowsContextType => {
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
        themes: [{ id: `light`, name: `Light` }],
        languages: [],
        actionManager: am,
        hotkeyManager: hm,
        currentlyOpenModal,
        changeActiveModal,
        codeThemes: defaultCodeThemes,
        currentCodeTheme: defaultCodeThemes[0],
        setCodeTheme: () => undefined,
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        toastSettings: defaultToastSettings,
        setToastSettings: () => undefined
    } as unknown as MowsContextType;
};

describe(`ModalHandler`, () => {
    it(`renders nothing visible when no modal is active`, () => {
        render(
            <MowsContext.Provider value={buildContext(undefined)}>
                <ModalHandler />
            </MowsContext.Provider>
        );
        expect(screen.queryByRole(`dialog`)).not.toBeInTheDocument();
    });

    it(`renders the theme-selector dialog when modal=themeSelector`, () => {
        render(
            <MowsContext.Provider value={buildContext(CoreModalTypes.themeSelector)}>
                <ModalHandler />
            </MowsContext.Provider>
        );
        const dialog = screen.getByRole(`dialog`);
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveTextContent(baseEn.themePicker.title);
    });

    it(`renders the language-selector dialog when modal=languageSelector`, () => {
        render(
            <MowsContext.Provider value={buildContext(CoreModalTypes.languageSelector)}>
                <ModalHandler />
            </MowsContext.Provider>
        );
        const dialog = screen.getByRole(`dialog`);
        expect(dialog).toHaveTextContent(baseEn.languagePicker.title);
    });

    it(`renders the keyboard-shortcut editor when modal=keyboardShortcutEditor`, () => {
        render(
            <MowsContext.Provider value={buildContext(CoreModalTypes.keyboardShortcutEditor)}>
                <ModalHandler />
            </MowsContext.Provider>
        );
        const dialog = screen.getByRole(`dialog`);
        expect(dialog).toHaveTextContent(baseEn.keyboardShortcuts.title);
    });

    it(`renders a custom modal via extraModals`, () => {
        const extra: Record<string, ModalEntry> = {
            myCustom: { component: () => <div data-testid={`custom`}>hello</div> }
        };
        render(
            <MowsContext.Provider value={buildContext(`myCustom`)}>
                <ModalHandler extraModals={extra} />
            </MowsContext.Provider>
        );
        expect(screen.getByTestId(`custom`)).toBeInTheDocument();
    });
});
