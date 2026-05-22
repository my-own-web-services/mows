import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// CodeMirror's editor needs layout APIs jsdom doesn't implement.
// Mock the CodeViewer component to a plain textarea for the settings tests —
// the real component is exercised in its own dedicated test suite.
vi.mock(`@/components/code/codeViewer/CodeViewer`, () => ({
    default: (props: {
        code: string;
        editable?: boolean;
        onCodeChange?: (next: string) => void;
    }) => (
        <textarea
            data-testid={`codeviewer-mock`}
            value={props.code}
            readOnly={!props.editable}
            onChange={(e) => props.onCodeChange?.(e.target.value)}
        />
    )
}));
import { defaultCodeThemes, type MowsCodeTheme } from "../../../lib/codeThemes";
import enTranslation from "../../../lib/languages/en-US/default";
import { defaultMapStyles, type MowsMapStyle } from "../../../lib/mapStyles";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import { defaultThemes, type MowsTheme } from "../../../lib/themes";
import SettingsPanel from "./SettingsPanel";

interface ContextStubs {
    setTheme?: (theme: MowsTheme) => void;
    setCodeTheme?: (theme: MowsCodeTheme) => void;
    setMapStyle?: (style: MowsMapStyle) => void;
    setLanguage?: (lang?: { code: string }) => void;
    setToastSettings?: (partial: Partial<{ position: string }>) => void;
    currentThemeId?: string;
    currentCodeThemeId?: string;
    currentMapStyleId?: string;
    toastPosition?: typeof defaultToastSettings.position;
}

const buildContext = (stubs: ContextStubs = {}): MowsContextType => {
    const actionManager = new ActionManager({
        recentActionsStorageKey: `s_${Math.random()}`,
        maxRecentActions: 5
    });
    const hotkeyManager = new HotkeyManager(actionManager, {
        configStorageKey: `hk_${Math.random()}`,
        defaultHotkeys: {}
    });

    const currentTheme =
        defaultThemes.find((th) => th.id === (stubs.currentThemeId ?? `light`)) ?? defaultThemes[0];
    const currentCodeTheme =
        defaultCodeThemes.find(
            (c) => c.id === (stubs.currentCodeThemeId ?? `vs-dark`)
        ) ?? defaultCodeThemes[0];
    const currentMapStyle =
        defaultMapStyles.find(
            (s) => s.id === (stubs.currentMapStyleId ?? defaultMapStyles[0].id)
        ) ?? defaultMapStyles[0];

    return {

        auth: {} as any,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async (theme) => {
            stubs.setTheme?.(theme);
        },
        currentTheme,
        setLanguage: stubs.setLanguage ?? (() => undefined),
        t: enTranslation,
        currentLanguage: {
            code: `en-US`,
            originalName: `English`,
            englishName: `English`,
            emoji: `🇺🇸`,
            import: () => Promise.reject()
        },
        themes: defaultThemes,
        languages: [
            { code: `en-US`, originalName: `English`, englishName: `English`, emoji: `🇺🇸`, import: () => Promise.reject() },
            { code: `de`, originalName: `Deutsch`, englishName: `German`, emoji: `🇩🇪`, import: () => Promise.reject() }
        ],
        actionManager,
        hotkeyManager,
        currentlyOpenModal: undefined,
        changeActiveModal: () => undefined,
        codeThemes: defaultCodeThemes,
        currentCodeTheme,
        setCodeTheme: stubs.setCodeTheme ?? (() => undefined),
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        toastSettings: {
            ...defaultToastSettings,
            position: stubs.toastPosition ?? defaultToastSettings.position
        },
        setToastSettings: stubs.setToastSettings ?? (() => undefined),
        mapStyles: defaultMapStyles,
        currentMapStyle,
        setMapStyle: stubs.setMapStyle ?? (() => undefined)
    };
};

const renderPanel = (stubs: ContextStubs = {}, children: ReactNode = <SettingsPanel />) =>
    render(<MowsContext.Provider value={buildContext(stubs)}>{children}</MowsContext.Provider>);

describe(`SettingsPanel`, () => {
    it(`renders the three section headings`, () => {
        renderPanel();
        expect(screen.getByRole(`heading`, { name: `Appearance` })).toBeInTheDocument();
        expect(screen.getByRole(`heading`, { name: `Code editor` })).toBeInTheDocument();
        expect(screen.getByRole(`heading`, { name: `Language` })).toBeInTheDocument();
    });

    it(`uses the standalone-style theme/code-theme/language pickers and shows their current values`, () => {
        renderPanel({ currentThemeId: `dark`, currentCodeThemeId: `hc-black` });
        // The picker triggers display the current selection name
        expect(screen.getByText(`Dark`)).toBeInTheDocument();
        expect(screen.getByText(`High Contrast Dark`)).toBeInTheDocument();
        // language picker shows the current language — both originalName and
        // englishName render as "English"; assert at least one match.
        expect(screen.getAllByText(`English`).length).toBeGreaterThan(0);
    });

    it(`switches to the JSON tab and shows current settings`, async () => {
        const user = userEvent.setup();
        renderPanel({ currentThemeId: `dark`, currentCodeThemeId: `hc-black` });

        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const textareas = await screen.findAllByTestId(`codeviewer-mock`);
        const textarea = textareas.find(
            (el) => !(el as HTMLTextAreaElement).readOnly
        ) as HTMLTextAreaElement;
        const parsed = JSON.parse(textarea.value);
        expect(parsed).toMatchObject({ theme: `dark`, codeTheme: `hc-black` });
    });

    it(`applies edited JSON when Save is clicked`, async () => {
        const user = userEvent.setup();
        const setTheme = vi.fn();
        const setCodeTheme = vi.fn();
        renderPanel({ setTheme, setCodeTheme });

        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const textareas = await screen.findAllByTestId(`codeviewer-mock`);
        const textarea = textareas.find((el) => !(el as HTMLTextAreaElement).readOnly) as HTMLTextAreaElement;

        await user.clear(textarea);
        await user.click(textarea);
        await user.paste(
            JSON.stringify({ theme: `dark`, codeTheme: `hc-light`, language: `en-US` }, null, 2)
        );

        await user.click(screen.getByRole(`button`, { name: `Save` }));

        expect(setTheme).toHaveBeenCalled();
        expect(setTheme.mock.calls[0][0].id).toBe(`dark`);
        expect(setCodeTheme).toHaveBeenCalled();
        expect(setCodeTheme.mock.calls[0][0].id).toBe(`hc-light`);
    });

    it(`renders the Notifications section with the toast position picker`, () => {
        renderPanel({ toastPosition: `top-left` });
        expect(screen.getByRole(`heading`, { name: `Notifications` })).toBeInTheDocument();
        // Trigger displays the currently selected position label.
        expect(screen.getByText(`Top left`)).toBeInTheDocument();
    });

    it(`includes toast settings in the JSON view`, async () => {
        const user = userEvent.setup();
        renderPanel({ toastPosition: `top-center` });
        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const textareas = await screen.findAllByTestId(`codeviewer-mock`);
        const textarea = textareas.find(
            (el) => !(el as HTMLTextAreaElement).readOnly
        ) as HTMLTextAreaElement;
        const parsed = JSON.parse(textarea.value);
        expect(parsed.toast).toEqual({ position: `top-center` });
    });

    it(`applies toast.position from edited JSON`, async () => {
        const user = userEvent.setup();
        const setToastSettings = vi.fn();
        renderPanel({ setToastSettings });

        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const textareas = await screen.findAllByTestId(`codeviewer-mock`);
        const textarea = textareas.find(
            (el) => !(el as HTMLTextAreaElement).readOnly
        ) as HTMLTextAreaElement;
        await user.clear(textarea);
        await user.click(textarea);
        await user.paste(
            JSON.stringify(
                {
                    theme: `light`,
                    codeTheme: `vs-dark`,
                    toast: { position: `bottom-left` }
                },
                null,
                2
            )
        );
        await user.click(screen.getByRole(`button`, { name: `Save` }));

        expect(setToastSettings).toHaveBeenCalledWith({ position: `bottom-left` });
    });

    it(`exposes a bracket-pair colorization toggle that calls setCodeEditorSettings`, async () => {
        const user = userEvent.setup();
        const setCodeEditorSettings = vi.fn();
        render(
            <MowsContext.Provider
                value={{
                    ...buildContext(),
                    setCodeEditorSettings
                }}
            >
                <SettingsPanel />
            </MowsContext.Provider>
        );

        const toggle = screen.getByRole(`switch`, {
            name: `Colorize bracket pairs`
        });
        // Default value is true, so the switch is initially checked.
        expect(toggle).toHaveAttribute(`aria-checked`, `true`);

        await user.click(toggle);
        expect(setCodeEditorSettings).toHaveBeenCalledWith({
            bracketPairColorization: false
        });
    });

    it(`shows an error when JSON is invalid`, async () => {
        const user = userEvent.setup();
        renderPanel();

        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const textareas = await screen.findAllByTestId(`codeviewer-mock`);
        const textarea = textareas.find((el) => !(el as HTMLTextAreaElement).readOnly) as HTMLTextAreaElement;
        await user.clear(textarea);
        await user.click(textarea);
        await user.paste(`{ not json`);
        await user.click(screen.getByRole(`button`, { name: `Save` }));

        expect(screen.getByText(/Invalid JSON/i)).toBeInTheDocument();
    });
});
