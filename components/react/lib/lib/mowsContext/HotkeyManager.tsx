import React from "react";
import { log } from "../logging";
import { ActionManager } from "./ActionManager";

export interface HotkeyConfig {
    [actionId: string]: {
        keyCombinations?: string[];
    };
}

export interface HotkeyManagerConfig {
    configStorageKey: string;
    defaultHotkeys: HotkeyConfig;
}

export class HotkeyManager {
    private actionManager: ActionManager;
    private hotkeyConfig: HotkeyConfig;
    private config: HotkeyManagerConfig;

    constructor(actionManager: ActionManager, config: HotkeyManagerConfig) {
        this.actionManager = actionManager;
        this.config = config;
        this.hotkeyConfig = this.loadHotkeyConfig();
        this.mergeWithDefaultHotkeys();

        document.addEventListener(`keydown`, (event) => {
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
        const defaultActionHotkeys = this.config.defaultHotkeys[actionId];

        if (defaultActionHotkeys) {
            this.hotkeyConfig[actionId] = { ...defaultActionHotkeys };
        } else {
            delete this.hotkeyConfig[actionId];
        }
        this.saveHotkeyConfig(this.hotkeyConfig);
    };

    resetAllToDefaults = (): void => {
        this.hotkeyConfig = { ...this.config.defaultHotkeys };
        this.saveHotkeyConfig(this.hotkeyConfig);
    };

    formatKeyCombo(event: KeyboardEvent | React.KeyboardEvent): string {
        const keys = [];

        if (event.ctrlKey || event.metaKey) keys.push(`ctrl`);
        if (event.altKey) keys.push(`alt`);
        if (event.shiftKey) keys.push(`shift`);

        let key = event.key.toLowerCase();
        if (![`control`, `alt`, `shift`, `meta`].includes(key)) {
            if (key === `escape`) key = `esc`;
            if (key === ` `) key = `space`;
            keys.push(key);
        }

        return keys.join(`+`);
    }

    parseKeyCombo = (combo: string): string => {
        return combo
            .replace(/\s+/g, ``)
            .split(`+`)
            .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
            .join(` + `);
    };

    mergeWithDefaultHotkeys = (): void => {
        this.hotkeyConfig = { ...this.config.defaultHotkeys, ...this.hotkeyConfig };
        this.saveHotkeyConfig(this.hotkeyConfig);
    };

    private saveHotkeyConfig = (hotkeyConfig: HotkeyConfig): void => {
        log.debug(`Saving custom hotkey config to localStorage:`, hotkeyConfig);
        localStorage.setItem(this.config.configStorageKey, JSON.stringify(hotkeyConfig));
    };

    private loadHotkeyConfig = (): HotkeyConfig => {
        const savedConfig = localStorage.getItem(this.config.configStorageKey);
        if (!savedConfig) {
            return {};
        }
        const parsedConfig = JSON.parse(savedConfig);
        return parsedConfig;
    };
}
