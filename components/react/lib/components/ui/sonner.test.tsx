import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toast } from "sonner";
import {
    type MowsToastSettings,
    MowsContext,
    defaultToastSettings
} from "../../lib/mowsContext/MowsContext";
import baseEnglishTranslation from "../../lib/languages/en-US/default";
import type { Translation } from "../../lib/languages";
import { ActionManager } from "../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../lib/mowsContext/HotkeyManager";
import { defaultCodeEditorSettings } from "../../lib/mowsContext/MowsContext";
import { defaultCodeThemes } from "../../lib/codeThemes";
import { Toaster } from "./sonner";

interface BuildOpts {
    readonly toastSettings?: MowsToastSettings;
}

const buildContext = ({ toastSettings = defaultToastSettings }: BuildOpts) => {
    const actionManager = new ActionManager({
        recentActionsStorageKey: `test_recent`,
        maxRecentActions: 5
    });
    const hotkeyManager = new HotkeyManager(actionManager, {
        configStorageKey: `test_hotkeys`,
        defaultHotkeys: {}
    });
    return {

        auth: { isAuthenticated: false } as any,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
        t: baseEnglishTranslation as Translation,
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
        toastSettings,
        setToastSettings: () => undefined
    };
};

describe(`Toaster`, () => {
    let originalMatchMedia: typeof window.matchMedia;
    beforeEach(() => {
        // Sonner reads matchMedia for theme; jsdom doesn't implement it.
        originalMatchMedia = window.matchMedia;
        window.matchMedia = ((query: string) => ({
            matches: false,
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            onchange: null,
            dispatchEvent: () => false
        })) as unknown as typeof window.matchMedia;
    });
    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    const renderToaster = (opts: BuildOpts = {}) =>
        render(
            <MowsContext.Provider value={buildContext(opts) as never}>
                <Toaster />
            </MowsContext.Provider>
        );

    // Sonner only renders its wrapper once it has toasts to show; emit one
    // then wait for `[data-sonner-toaster]` to appear in the DOM.
    const findToasterRoot = async () => {
        act(() => {
            toast(`probe`);
        });
        return waitFor(() => {
            const root = document.querySelector(`[data-sonner-toaster]`);
            if (!root) throw new Error(`sonner root not mounted yet`);
            return root;
        });
    };

    it(`reads the position from MowsContext (top-left)`, async () => {
        renderToaster({ toastSettings: { position: `top-left` } });
        const root = await findToasterRoot();
        expect(root).toHaveAttribute(`data-y-position`, `top`);
        expect(root).toHaveAttribute(`data-x-position`, `left`);
    });

    it(`reads the position from MowsContext (bottom-center)`, async () => {
        renderToaster({ toastSettings: { position: `bottom-center` } });
        const root = await findToasterRoot();
        expect(root).toHaveAttribute(`data-y-position`, `bottom`);
        expect(root).toHaveAttribute(`data-x-position`, `center`);
    });

    it(`prop position overrides context`, async () => {
        render(
            <MowsContext.Provider
                value={buildContext({ toastSettings: { position: `top-left` } }) as never}
            >
                <Toaster position={`bottom-right`} />
            </MowsContext.Provider>
        );
        const root = await findToasterRoot();
        expect(root).toHaveAttribute(`data-y-position`, `bottom`);
        expect(root).toHaveAttribute(`data-x-position`, `right`);
    });

    it(`renders outside a MowsProvider and mounts a working Sonner host`, async () => {
        // QA-17: tightened the previous `expect(...).not.toThrow()` (which
        // only proved no exception was thrown — gave coverage credit without
        // observing behaviour). Now we render the Toaster without a context,
        // dispatch a toast, and assert the Sonner host actually paints it.
        // This catches a future regression where the no-context branch
        // returns `null` early.
        render(<Toaster />);
        toast(`hello-from-no-provider`);
        await screen.findByText(`hello-from-no-provider`);
    });
});
