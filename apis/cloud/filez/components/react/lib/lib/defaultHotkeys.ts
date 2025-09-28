import { ActionIds } from "./defaultActions";
import { HotkeyConfig } from "./filezContext/HotkeyManager";

export const defaultHotkeys: HotkeyConfig = {
    [ActionIds.OPEN_COMMAND_PALETTE]: {
        keyCombinations: ["ctrl+shift+p", "meta+k"]
    }
};
