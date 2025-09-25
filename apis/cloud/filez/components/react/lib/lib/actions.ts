import type { ActionDefinition } from "./ActionManager";
import { HOTKEY_DEFAULT_SCOPE } from "./constants";
import type { FilezClientManagerBase } from "./FilezContext";

export const defineApplicationActions = (
    filezContextProvider: FilezClientManagerBase
): ActionDefinition[] => {
    return [
        {
            id: "app.openCommandPalette",
            category: "General",
            scope: HOTKEY_DEFAULT_SCOPE,
            handler: () => {}
        },
        {
            id: "app.openKeyboardShortcuts",
            category: "General",
            scope: HOTKEY_DEFAULT_SCOPE,
            handler: () => filezContextProvider.changeActiveModal("keyboardShortcutEditor")
        }
    ];
};
