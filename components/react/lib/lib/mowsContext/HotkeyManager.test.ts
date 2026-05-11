import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ActionManager } from "./ActionManager";
import { HotkeyManager } from "./HotkeyManager";

const buildManager = (configKey: string) => {
    const actionManager = new ActionManager({
        recentActionsStorageKey: `recent-${configKey}`,
        maxRecentActions: 5
    });
    const hotkeyManager = new HotkeyManager(actionManager, {
        configStorageKey: configKey,
        defaultHotkeys: {}
    });
    return { actionManager, hotkeyManager };
};

describe(`HotkeyManager`, () => {
    let originalUserAgent: PropertyDescriptor | undefined;

    beforeEach(() => {
        localStorage.clear();
        originalUserAgent = Object.getOwnPropertyDescriptor(navigator, `userAgent`);
        Object.defineProperty(navigator, `userAgent`, {
            value: `Mozilla/5.0 (X11; Linux x86_64)`,
            configurable: true
        });
    });

    afterEach(() => {
        if (originalUserAgent) {
            Object.defineProperty(navigator, `userAgent`, originalUserAgent);
        }
        localStorage.clear();
    });

    it(`formats Ctrl+Shift+P as mod+shift+p on a non-Mac platform`, () => {
        const { hotkeyManager } = buildManager(`hk-format-1`);
        const combo = hotkeyManager.formatKeyCombo(
            new KeyboardEvent(`keydown`, {
                key: `P`,
                ctrlKey: true,
                shiftKey: true
            })
        );
        expect(combo).toBe(`mod+shift+p`);
    });

    it(`migrates legacy ctrl-based stored configs to mod on first load`, () => {
        const configKey = `hk-migrate-1`;
        // Simulate a config saved by a previous version of the app, before
        // the `mod` token existed.
        localStorage.setItem(
            configKey,
            JSON.stringify({
                "ui.open-command-palette": { keyCombinations: [`ctrl+shift+p`] },
                "ui.toggle-theme": { keyCombinations: [`ctrl+shift+t`, `alt+t`] }
            })
        );

        const { hotkeyManager } = buildManager(configKey);

        expect(hotkeyManager.getHotkeysByActionId(`ui.open-command-palette`)).toEqual([
            `mod+shift+p`
        ]);
        expect(hotkeyManager.getHotkeysByActionId(`ui.toggle-theme`)).toEqual([
            `mod+shift+t`,
            `alt+t`
        ]);
    });

    it(`leaves modifierless combos untouched during migration`, () => {
        const configKey = `hk-migrate-2`;
        localStorage.setItem(
            configKey,
            JSON.stringify({
                "ui.escape": { keyCombinations: [`escape`] }
            })
        );
        const { hotkeyManager } = buildManager(configKey);
        expect(hotkeyManager.getHotkeysByActionId(`ui.escape`)).toEqual([`escape`]);
    });

    it(`recovers from corrupt stored config by starting fresh`, () => {
        const configKey = `hk-corrupt`;
        localStorage.setItem(configKey, `not-json-{`);
        const { hotkeyManager } = buildManager(configKey);
        expect(hotkeyManager.getHotkeysByActionId(`anything`)).toEqual([]);
    });
});
