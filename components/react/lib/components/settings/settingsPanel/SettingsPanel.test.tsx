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
import { createAppSettingsContextValue } from "../../../lib/mowsContext/appSettings";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import { SettingsManager, type SettingsStorageAdapter } from "../../../lib/mowsContext/SettingsManager";
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

const inMemoryStorage = (): SettingsStorageAdapter => {
    const data = new Map<string, string>();
    return {
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => {
            data.set(k, v);
        },
        removeItem: (k) => {
            data.delete(k);
        }
    };
};

const buildContext = (stubs: ContextStubs = {}): MowsContextType => {
    const settingsManager = new SettingsManager({
        storagePrefix: `test_${Math.random()}`,
        storage: inMemoryStorage()
    });
    const actionManager = new ActionManager({
        recentActionsSlot: settingsManager.deviceSlotAdapter(`recentActions`),
        maxRecentActions: 5
    });
    const hotkeyManager = new HotkeyManager(actionManager, {
        configSlot: settingsManager.deviceSlotAdapter(`hotkeyConfig`),
        defaultHotkeys: {}
    });
    const appSettings = createAppSettingsContextValue(settingsManager, null);

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
        setMapStyle: stubs.setMapStyle ?? (() => undefined),
        settingsManager,
        appSettings
    };
};

const renderPanel = (stubs: ContextStubs = {}, children: ReactNode = <SettingsPanel />) => {
    const ctx = buildContext(stubs);
    const utils = render(
        <MowsContext.Provider value={ctx}>{children}</MowsContext.Provider>
    );
    return { ...utils, ctx };
};

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

    it(`switches to the JSON tab and shows the unified settings blob`, async () => {
        const user = userEvent.setup();
        const { ctx } = renderPanel();
        // Seed the manager so the JSON tab has something to show — the
        // blob shape is `{ _v, core: {...}, app: {...} }`, not the
        // legacy flat object.
        ctx.settingsManager.setCore(`theme`, `dark`);
        ctx.settingsManager.setCore(`codeTheme`, `hc-black`);

        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const textareas = await screen.findAllByTestId(`codeviewer-mock`);
        const textarea = textareas.find(
            (el) => !(el as HTMLTextAreaElement).readOnly
        ) as HTMLTextAreaElement;
        const parsed = JSON.parse(textarea.value);
        expect(parsed._v).toBe(1);
        expect(parsed.core).toMatchObject({ theme: `dark`, codeTheme: `hc-black` });
    });

    it(`pastes a wholesale blob into the JSON tab and calls replaceBlob`, async () => {
        const user = userEvent.setup();
        const { ctx } = renderPanel();
        const replaceSpy = vi.spyOn(ctx.settingsManager, `replaceBlob`);

        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const textareas = await screen.findAllByTestId(`codeviewer-mock`);
        const textarea = textareas.find(
            (el) => !(el as HTMLTextAreaElement).readOnly
        ) as HTMLTextAreaElement;

        const nextBlob = {
            _v: 1,
            core: { theme: `dark`, codeTheme: `hc-light`, language: `en-US` },
            app: { example: { foo: `bar` } }
        };
        await user.clear(textarea);
        await user.click(textarea);
        await user.paste(JSON.stringify(nextBlob, null, 2));

        await user.click(screen.getByRole(`button`, { name: `Save` }));

        expect(replaceSpy).toHaveBeenCalledTimes(1);
        expect(replaceSpy.mock.calls[0][0]).toEqual(nextBlob);
    });

    it(`rejects a JSON paste whose _v doesn't match the current version`, async () => {
        const user = userEvent.setup();
        const { ctx } = renderPanel();
        const blobBefore = ctx.settingsManager.getBlob();

        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const textareas = await screen.findAllByTestId(`codeviewer-mock`);
        const textarea = textareas.find(
            (el) => !(el as HTMLTextAreaElement).readOnly
        ) as HTMLTextAreaElement;

        await user.clear(textarea);
        await user.click(textarea);
        await user.paste(JSON.stringify({ _v: 999, core: {}, app: {} }, null, 2));
        await user.click(screen.getByRole(`button`, { name: `Save` }));

        // SettingsManager.replaceBlob throws SettingsBlobValidationError;
        // the panel catches it, shows the error, and leaves the stored
        // blob untouched.
        expect(ctx.settingsManager.getBlob()).toBe(blobBefore);
        expect(screen.getByText(/Invalid JSON/i)).toBeInTheDocument();
    });

    it(`renders the Notifications section with the toast position picker`, () => {
        renderPanel({ toastPosition: `top-left` });
        expect(screen.getByRole(`heading`, { name: `Notifications` })).toBeInTheDocument();
        // Trigger displays the currently selected position label.
        expect(screen.getByText(`Top left`)).toBeInTheDocument();
    });

    it(`exposes the toast slot inside core in the JSON view`, async () => {
        const user = userEvent.setup();
        const { ctx } = renderPanel();
        ctx.settingsManager.setCore(`toast`, { position: `top-center` });
        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const textareas = await screen.findAllByTestId(`codeviewer-mock`);
        const textarea = textareas.find(
            (el) => !(el as HTMLTextAreaElement).readOnly
        ) as HTMLTextAreaElement;
        const parsed = JSON.parse(textarea.value);
        expect(parsed.core.toast).toEqual({ position: `top-center` });
    });

    it(`a pasted blob with core.toast lands in the manager after save`, async () => {
        const user = userEvent.setup();
        const { ctx } = renderPanel();

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
                    _v: 1,
                    core: {
                        theme: `light`,
                        codeTheme: `vs-dark`,
                        toast: { position: `bottom-left` }
                    },
                    app: {}
                },
                null,
                2
            )
        );
        await user.click(screen.getByRole(`button`, { name: `Save` }));

        expect(ctx.settingsManager.getCore(`toast`)).toEqual({ position: `bottom-left` });
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

    it(`app-settings custom render escape hatch: receives value + setValue`, async () => {
        const user = userEvent.setup();
        const baseCtx = buildContext();
        const renderSpy = vi.fn();
        const schema = {
            appKey: `filez`,
            schema: {
                nickname: {
                    type: `string` as const,
                    default: `anon`,
                    label: `Nickname`,
                    group: `Profile`,
                    // Custom renderer overrides the default text Input.
                    render: ({ value, setValue }: { value: string; setValue: (v: string) => void }) => {
                        renderSpy(value);
                        return (
                            <button
                                type={`button`}
                                onClick={() => setValue(`${value}!`)}
                                data-testid={`nickname-custom`}
                            >
                                {value}
                            </button>
                        );
                    }
                }
            }
        };
        const ctx: MowsContextType = {
            ...baseCtx,
            appSettings: createAppSettingsContextValue(baseCtx.settingsManager, schema)
        };
        render(
            <MowsContext.Provider value={ctx}>
                <SettingsPanel />
            </MowsContext.Provider>
        );
        const button = screen.getByTestId(`nickname-custom`);
        expect(button).toHaveTextContent(`anon`);
        expect(renderSpy).toHaveBeenCalledWith(`anon`);
        await user.click(button);
        expect(ctx.settingsManager.getApp(`filez`, `nickname`)).toBe(`anon!`);
    });

    it(`app-settings group label slugs are stable across special characters`, () => {
        const baseCtx = buildContext();
        const schema = {
            appKey: `filez`,
            schema: {
                a: { type: `boolean` as const, default: false, label: `A`, group: `My  Group!` },
                b: { type: `boolean` as const, default: false, label: `B`, group: `My  Group!` }
            }
        };
        const ctx: MowsContextType = {
            ...baseCtx,
            appSettings: createAppSettingsContextValue(baseCtx.settingsManager, schema)
        };
        render(
            <MowsContext.Provider value={ctx}>
                <SettingsPanel />
            </MowsContext.Provider>
        );
        // Both fields land in the same section (one heading rendered,
        // not two — special chars are slugged consistently). Accessible-
        // name matching normalises whitespace, so the double-space in
        // the schema literal collapses to a single space here.
        expect(screen.getAllByRole(`heading`, { name: /^My Group!$/ })).toHaveLength(1);
    });

    it(`renders an app-settings section when a schema is registered`, async () => {
        // Build a context with a registered app schema rather than the
        // default null. We can't use the test fixture because it always
        // passes null — patch the appSettings field manually.
        const baseCtx = buildContext();
        const schema = {
            appKey: `filez`,
            schema: {
                showHidden: {
                    type: `boolean` as const,
                    default: false,
                    label: `Show hidden`,
                    group: `Display`
                },
                defaultView: {
                    type: `select` as const,
                    options: [
                        { value: `grid`, label: `Grid` },
                        { value: `list`, label: `List` }
                    ],
                    default: `grid`,
                    label: `Default view`,
                    group: `Display`
                }
            }
        };
        const ctx: MowsContextType = {
            ...baseCtx,
            appSettings: createAppSettingsContextValue(baseCtx.settingsManager, schema)
        };

        render(
            <MowsContext.Provider value={ctx}>
                <SettingsPanel />
            </MowsContext.Provider>
        );

        // The "Display" group becomes a section heading.
        expect(
            screen.getByRole(`heading`, { name: `Display` })
        ).toBeInTheDocument();

        // The boolean field renders as a Switch — clicking it persists
        // through the settings manager.
        const user = userEvent.setup();
        const toggle = screen.getByRole(`switch`, { name: `Show hidden` });
        expect(toggle).toHaveAttribute(`aria-checked`, `false`);
        await user.click(toggle);
        expect(ctx.settingsManager.getApp(`filez`, `showHidden`)).toBe(true);
    });

    it(`export → import round-trip: copy the JSON blob, paste into a fresh manager, blob matches`, async () => {
        // The marquee user-facing promise: "copy this JSON, paste it
        // anywhere, recover everything." This integration test seeds
        // a manager, grabs the JSON-tab text, pastes it into a
        // separately-rendered second panel, and verifies the second
        // manager ends up with the same blob.
        const user = userEvent.setup();
        const { ctx: sourceCtx, unmount } = renderPanel();
        sourceCtx.settingsManager.setCore(`theme`, `dark`);
        sourceCtx.settingsManager.setCore(`language`, `de`);
        sourceCtx.settingsManager.setApp(`filez`, `defaultView`, `list`);

        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const sourceTextareas = await screen.findAllByTestId(`codeviewer-mock`);
        const sourceTextarea = sourceTextareas.find(
            (el) => !(el as HTMLTextAreaElement).readOnly
        ) as HTMLTextAreaElement;
        const exported = sourceTextarea.value;
        const exportedParsed = JSON.parse(exported);
        unmount();

        // Render a fresh, empty panel + manager (simulates another
        // browser / install).
        const { ctx: targetCtx } = renderPanel();
        expect(targetCtx.settingsManager.getCore(`theme`)).toBeUndefined();

        await user.click(screen.getByRole(`button`, { name: `JSON` }));
        const targetTextareas = await screen.findAllByTestId(`codeviewer-mock`);
        const targetTextarea = targetTextareas.find(
            (el) => !(el as HTMLTextAreaElement).readOnly
        ) as HTMLTextAreaElement;
        await user.clear(targetTextarea);
        await user.click(targetTextarea);
        await user.paste(exported);
        await user.click(screen.getByRole(`button`, { name: `Save` }));

        expect(targetCtx.settingsManager.getBlob()).toEqual(exportedParsed);
        expect(targetCtx.settingsManager.getCore(`theme`)).toBe(`dark`);
        expect(targetCtx.settingsManager.getCore(`language`)).toBe(`de`);
        expect(targetCtx.settingsManager.getApp(`filez`, `defaultView`)).toBe(`list`);
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
