import React from "react";
import { HOTKEY_CONFIG_LOCAL_STORAGE_KEY } from "../constants";
import { defaultHotkeys } from "../defaultHotkeys";
import { log } from "../logging";
import { ActionManager } from "./ActionManager";

export interface HotkeyConfig {
    [actionId: string]: {
        // List of key combinations that trigger the action
        keyCombinations?: string[];
    };
}

export class HotkeyManager {
    private actionManager: ActionManager;
    private hotkeyConfig: HotkeyConfig;

    constructor(actionManager: ActionManager) {
        this.actionManager = actionManager;
        this.hotkeyConfig = this.loadHotkeyConfig();
        this.mergeWithDefaultHotkeys();

        // capture hotkeys and dispatch actions
        document.addEventListener(`keydown`, (event) => {
            //log.debug("Keydown event:", event);
            const keyCombo = this.formatKeyCombo(event);
            const actionId = this.getActionByHotkey(keyCombo);
            if (actionId) {
                log.debug(`Hotkey pressed: ${keyCombo}, triggering action: ${actionId}`);
                event.preventDefault();
                this.actionManager.dispatchAction(actionId);
            }
        });
    }

    getActionByHotkey = (keyCombo: string): string | null => {
        for (const actionId in this.hotkeyConfig) {
            if (this.hotkeyConfig[actionId].keyCombinations?.includes(keyCombo)) {
                return actionId;
            }
        }
        return null;
    };

    getHotkeysByActionId = (actionId: string): string[] => {
        return this.hotkeyConfig[actionId]?.keyCombinations || [];
    };

    updateHotkey = (actionId: string, newKeys: string[]): void => {
        if (!this.hotkeyConfig[actionId]) {
            this.hotkeyConfig[actionId] = { keyCombinations: [] };
        }
        this.hotkeyConfig[actionId].keyCombinations = newKeys;
        this.saveHotkeyConfig(this.hotkeyConfig);
    };

    resetActionHotkeysToDefault = (actionId: string): void => {
        const defaultActionHotkeys = defaultHotkeys[actionId];

        if (defaultActionHotkeys) {
            this.hotkeyConfig[actionId] = { ...defaultActionHotkeys };
        } else {
            delete this.hotkeyConfig[actionId];
        }
        this.saveHotkeyConfig(this.hotkeyConfig);
    };

    resetAllToDefaults = (): void => {
        this.hotkeyConfig = { ...defaultHotkeys };
        this.saveHotkeyConfig(this.hotkeyConfig);
    };

    formatKeyCombo(event: KeyboardEvent | React.KeyboardEvent): string {
        const keys = [];

        if (event.ctrlKey || event.metaKey) keys.push(`ctrl`);
        if (event.altKey) keys.push(`alt`);
        if (event.shiftKey) keys.push(`shift`);

        // Add the actual key
        let key = event.key.toLowerCase();
        if (![`control`, `alt`, `shift`, `meta`].includes(key)) {
            if (key === `escape`) key = `esc`;
            if (key === ` `) key = `space`;
            keys.push(key);
        }

        return keys.join(`+`);
    }

    // Normalize key combo for display
    parseKeyCombo = (combo: string): string => {
        return combo
            .replace(/\s+/g, ``)
            .split(`+`)
            .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
            .join(` + `);
    };

    mergeWithDefaultHotkeys = (): void => {
        this.hotkeyConfig = { ...defaultHotkeys, ...this.hotkeyConfig };
        this.saveHotkeyConfig(this.hotkeyConfig);
    };

    private saveHotkeyConfig = (hotkeyConfig: HotkeyConfig): void => {
        log.debug(`Saving custom hotkey config to localStorage:`, hotkeyConfig);
        localStorage.setItem(HOTKEY_CONFIG_LOCAL_STORAGE_KEY, JSON.stringify(hotkeyConfig));
    };

    private loadHotkeyConfig = (): HotkeyConfig => {
        const savedConfig = localStorage.getItem(HOTKEY_CONFIG_LOCAL_STORAGE_KEY);
        if (!savedConfig) {
            return {};
        }
        const parsedConfig = JSON.parse(savedConfig);
        return parsedConfig;
    };
}
