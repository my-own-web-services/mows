import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import type { Language } from "../../../lib/languages";
import baseEn from "../../../lib/languages/en-US/default";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import LanguagePicker from "./LanguagePicker";

const ENGLISH: Language = {
    code: `en-US`,
    originalName: `English`,
    englishName: `English (US)`,
    emoji: `🇺🇸`,
    import: () => Promise.reject()
};

const GERMAN: Language = {
    code: `de`,
    originalName: `Deutsch`,
    englishName: `German`,
    emoji: `🇩🇪`,
    import: () => Promise.reject()
};

const buildContext = (setLanguage = vi.fn()): MowsContextType => {
    const am = new ActionManager({ recentActionsStorageKey: `t`, maxRecentActions: 5 });
    const hm = new HotkeyManager(am, { configStorageKey: `t-hk`, defaultHotkeys: {} });
    return {

        auth: {} as never,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage,
        t: baseEn,
        currentLanguage: ENGLISH,
        themes: [],
        languages: [ENGLISH, GERMAN],
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

const renderPicker = (
    opts: { setLanguage?: ReturnType<typeof vi.fn>; standalone?: boolean } = {}
) => {
    const setLanguage = opts.setLanguage ?? vi.fn();
    const ctx = buildContext(setLanguage);
    return {
        setLanguage,
        ...render(
            <MowsContext.Provider value={ctx}>
                <LanguagePicker standalone={opts.standalone} />
            </MowsContext.Provider>
        )
    };
};

describe(`LanguagePicker`, () => {
    it(`lists every language in standalone mode`, () => {
        renderPicker({ standalone: true });
        expect(screen.getByText(`English`)).toBeInTheDocument();
        expect(screen.getByText(`Deutsch`)).toBeInTheDocument();
    });

    it(`fires setLanguage on the surrounding context when a language is picked`, async () => {
        const user = userEvent.setup();
        const { setLanguage } = renderPicker({ standalone: true });
        await user.click(screen.getByText(`Deutsch`));
        expect(setLanguage).toHaveBeenCalledWith(GERMAN);
    });

    it(`renders the popover trigger with the current language by default`, () => {
        renderPicker();
        // The trigger displays the originalName + emoji of the currentLanguage.
        const trigger = screen.getByTitle(baseEn.languagePicker.selectLanguage);
        expect(trigger).toHaveTextContent(`English`);
    });
});
