import type { HotkeyDefinition, HotkeyManager } from "./HotkeyManager";

export const defineApplicationHotkeys = (hotkeyManager: HotkeyManager) => {
    const hotkeys: HotkeyDefinition[] = [
        {
            actionId: "app.openPrimaryMenu",
            defaultKey: "esc"
        },
        {
            actionId: "app.openCommandPalette",
            defaultKey: "ctrl+shift+p"
        },
        {
            actionId: "app.openCommandPalette",
            defaultKey: "meta+k"
        }
    ];

    hotkeyManager.defineMultipleHotkeys(hotkeys);
};
