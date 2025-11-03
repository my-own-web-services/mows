import { ActionIds } from "./defaultActions";
import { HotkeyConfig } from "./filezContext/HotkeyManager";

export const defaultHotkeys: HotkeyConfig = {
    [ActionIds.OPEN_COMMAND_PALETTE]: {
        keyCombinations: [`ctrl+shift+p`, `meta+k`]
    },
    [ActionIds.DELETE_FILES]: {
        keyCombinations: [`delete`]
    },
    [ActionIds.DELETE_JOBS]: {
        keyCombinations: [`delete`]
    }
};
