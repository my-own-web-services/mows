import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultCodeThemes } from "../../lib/lib/codeThemes";
import { ActionManager } from "../../lib/lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../lib/lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../lib/lib/mowsContext/MowsContext";
import enTranslation from "../languages/en-US";
import deTranslation from "../languages/de";
import { TranslationsGuide } from "./TranslationsGuide";

const buildContext = (t: typeof enTranslation): MowsContextType => {
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
        t,
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

const renderGuide = (t: typeof enTranslation) =>
    render(
        <MowsContext.Provider value={buildContext(t)}>
            <TranslationsGuide />
        </MowsContext.Provider>
    );

describe(`TranslationsGuide`, () => {
    it(`renders every top-level section heading from the English tree`, () => {
        renderGuide(enTranslation);
        const t = enTranslation.example.guides.translations;
        for (const section of [
            t.overview.title,
            t.setup.title,
            t.reading.title,
            t.extending.title,
            t.slicing.title,
            t.switching.title,
            t.safety.title,
            t.conventions.title
        ]) {
            expect(
                screen.queryAllByText(section).length,
                `expected section heading "${section}" to render`
            ).toBeGreaterThan(0);
        }
    });

    it(`renders every top-level section heading from the German tree`, () => {
        renderGuide(deTranslation);
        const t = deTranslation.example.guides.translations;
        for (const section of [
            t.overview.title,
            t.setup.title,
            t.reading.title,
            t.extending.title,
            t.slicing.title,
            t.switching.title,
            t.safety.title,
            t.conventions.title
        ]) {
            expect(
                screen.queryAllByText(section).length,
                `expected section heading "${section}" to render`
            ).toBeGreaterThan(0);
        }
    });

    it(`throws when rendered outside <MowsProvider>`, () => {
        const consoleError = vi.spyOn(console, `error`).mockImplementation(() => undefined);
        expect(() => render(<TranslationsGuide />)).toThrow(/must be rendered inside/);
        consoleError.mockRestore();
    });
});
