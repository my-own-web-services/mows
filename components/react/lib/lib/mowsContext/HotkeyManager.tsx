import React from "react";
import { log } from "../logging";
import { ActionManager } from "./ActionManager";

/**
 * Returns true when the user is on a Mac-style platform (Mac, iPhone, iPad).
 * Used to map the `mod` hotkey token to Cmd on Mac and Ctrl elsewhere.
 */
export const isMacPlatform = (): boolean => {
    if (typeof navigator === `undefined`) return false;
    const platformProbe = `${navigator.platform || ``} ${navigator.userAgent || ``}`;
    return /Mac|iPhone|iPad|iPod/.test(platformProbe);
};

export interface HotkeyConfig {
    [actionId: string]: {
        keyCombinations?: string[];
    };
}

/**
 * Generic JSON-typed storage slot. SettingsManager hands a slot
 * pointing into the unified settings blob (`core.hotkeyConfig`) so the
 * manager keeps its own parse/validate logic but doesn't own a
 * standalone localStorage key. Tests can pass an in-memory slot.
 */
export interface HotkeyConfigSlot {
    get(): unknown;
    set(value: HotkeyConfig): void;
}

/** Discriminated union — exactly one of `configSlot` (preferred) or
 * `configStorageKey` (deprecated) must be provided. */
export type HotkeyManagerConfig =
    | {
          readonly configSlot: HotkeyConfigSlot;
          readonly configStorageKey?: never;
          readonly defaultHotkeys: HotkeyConfig;
      }
    | {
          /** @deprecated Use `configSlot`. */
          readonly configStorageKey: string;
          readonly configSlot?: never;
          readonly defaultHotkeys: HotkeyConfig;
      };

export class HotkeyManager {
    private actionManager: ActionManager;
    private hotkeyConfig: HotkeyConfig;
    private config: HotkeyManagerConfig;
    private slot: HotkeyConfigSlot;

    constructor(actionManager: ActionManager, config: HotkeyManagerConfig) {
        this.actionManager = actionManager;
        this.config = config;
        this.slot = resolveHotkeyConfigSlot(config);
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
        const mac = isMacPlatform();
        const keys: string[] = [];

        // `mod` = the platform's primary command modifier: Cmd on Mac, Ctrl
        // elsewhere. `ctrl` and `meta` remain available as literal modifiers
        // for the rare case a hotkey needs to bind to the non-primary key.
        if (mac) {
            if (event.metaKey) keys.push(`mod`);
            if (event.ctrlKey) keys.push(`ctrl`);
        } else {
            if (event.ctrlKey) keys.push(`mod`);
            if (event.metaKey) keys.push(`meta`);
        }
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
        log.debug(`Saving custom hotkey config:`, hotkeyConfig);
        this.slot.set(hotkeyConfig);
    };

    private loadHotkeyConfig = (): HotkeyConfig => {
        const stored = this.slot.get();
        if (!stored || typeof stored !== `object`) return {};
        try {
            return migrateLegacyModifierTokens(stored as HotkeyConfig);
        } catch (error) {
            log.warn(`Failed to migrate stored hotkey config; starting fresh`, error);
            return {};
        }
    };
}

/**
 * Pick the right slot implementation from the manager config. New
 * callers pass a `configSlot`; legacy callers (tests, older apps)
 * still set `configStorageKey` and get a localStorage-backed slot.
 */
const resolveHotkeyConfigSlot = (config: HotkeyManagerConfig): HotkeyConfigSlot => {
    if (config.configSlot && config.configStorageKey) {
        throw new Error(
            `HotkeyManager: provide either configSlot OR configStorageKey, not both`
        );
    }
    if (config.configSlot) return config.configSlot;
    if (config.configStorageKey) {
        const key = config.configStorageKey;
        return {
            get: () => {
                const raw = localStorage.getItem(key);
                if (!raw) return undefined;
                try {
                    return JSON.parse(raw) as unknown;
                } catch (error) {
                    log.warn(`Failed to parse stored hotkey config at ${key}`, error);
                    return undefined;
                }
            },
            set: (value) => {
                localStorage.setItem(key, JSON.stringify(value));
            }
        };
    }
    throw new Error(
        `HotkeyManager requires either configSlot or configStorageKey in its config`
    );
};

/**
 * Rewrites the platform-primary modifier in stored hotkey configs from the
 * pre-`mod` format (`ctrl` on non-Mac, `meta` on Mac) to the new `mod` token.
 * Without this, user-saved bindings never match the new dispatch path.
 */
const migrateLegacyModifierTokens = (config: HotkeyConfig): HotkeyConfig => {
    const mac = isMacPlatform();
    const legacyPrimary = mac ? `meta` : `ctrl`;
    const result: HotkeyConfig = {};
    for (const [actionId, entry] of Object.entries(config)) {
        const combos = entry.keyCombinations;
        if (!combos) {
            result[actionId] = entry;
            continue;
        }
        result[actionId] = {
            keyCombinations: combos.map((combo) =>
                combo
                    .split(`+`)
                    .map((token) => (token === legacyPrimary ? `mod` : token))
                    .join(`+`)
            )
        };
    }
    return result;
};
