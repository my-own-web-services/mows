import hotkeys from "hotkeys-js";
import React, { useEffect } from "react";
import { ActionManager, type ActionDefinition } from "./ActionManager";
import { HOTKEY_CONFIG_LOCAL_STORAGE_KEY, HOTKEY_DEFAULT_SCOPE } from "./constants";
import { useFilez } from "./FilezContext";
import { log } from "./logging";

export type KeyEventType = "keydown" | "keypress" | "keyup";

// Re-export ActionDefinition from ActionManager for backwards compatibility
export type { ActionDefinition } from "./ActionManager";

// Hotkey definition - key combination that triggers an action
export interface HotkeyDefinition {
    actionId: string;
    defaultKey: string;
    eventType?: "keydown" | "keyup" | "keypress";
    enabled?: boolean;
}

export interface HotkeyConfig {
    [actionId: string]: string; // actionId -> current key binding
}

// Create the hotkey manager
export class HotkeyManager {
    private actionManager: ActionManager;
    private hotkeys: Map<string, HotkeyDefinition> = new Map();
    private customConfig: HotkeyConfig = {};
    private activeScopes: Set<string> = new Set([HOTKEY_DEFAULT_SCOPE]);
    private exclusiveScope: string | null = null;
    private registeredKeys: Map<string, Set<string>> = new Map(); // key -> hotkeyIds

    constructor(actionManager?: ActionManager) {
        this.actionManager = actionManager || new ActionManager();
        log.debug("HotkeyManager constructor - initial scope:", hotkeys.getScope());

        // Load saved config from localStorage
        const savedConfig = localStorage.getItem(HOTKEY_CONFIG_LOCAL_STORAGE_KEY);
        if (savedConfig) {
            try {
                this.customConfig = JSON.parse(savedConfig);
            } catch (e) {
                console.error("Failed to load hotkey config:", e);
            }
        }

        // Setup hotkeys-js
        hotkeys.filter = (event) => {
            const target = event.target as HTMLElement;
            const tagName = target.tagName;
            const isContentEditable = target.contentEditable === "true";
            const keyCombo = this.formatKeyCombo(event);

            log.debug(`Hotkeys filter called:`, { keyCombo, tagName, isContentEditable });

            // Check if we should block hotkeys in input fields
            if (tagName === "INPUT" || tagName === "TEXTAREA" || isContentEditable) {
                // Allow specific hotkeys even in input fields

                // Find if this hotkey is marked as 'allowInInput'
                for (const [hotkeyId, hotkey] of this.hotkeys) {
                    const currentKey = this.getCurrentKey(hotkey.actionId, hotkey.defaultKey);
                    const action = this.actionManager.getAction(hotkey.actionId);
                    if (currentKey === keyCombo && action?.handler) {
                        // You could add an 'allowInInput' flag to HotkeyDefinition if needed
                        // For now, allow Ctrl+S and Escape in inputs
                        if (keyCombo === "ctrl+s" || keyCombo === "escape") {
                            log.debug(`Allowing ${keyCombo} in input field`);
                            return true;
                        }
                    }
                }
                log.debug(`Blocking ${keyCombo} in input field`);
                return false;
            }
            log.debug(`Allowing ${keyCombo}`);
            return true;
        };

        // Initialize hotkeys-js scope
        this.updateHotkeysScope();
    }

    // Action Management - delegate to ActionManager
    defineAction(action: ActionDefinition): void {
        this.actionManager.defineAction(action);
    }

    defineMultipleActions(actions: ActionDefinition[]): void {
        this.actionManager.defineMultipleActions(actions);
    }

    getAction(actionId: string): ActionDefinition | undefined {
        return this.actionManager.getAction(actionId);
    }

    getAllActions(): Map<string, ActionDefinition> {
        return this.actionManager.getAllActions();
    }

    getActionsByCategory(category: string): ActionDefinition[] {
        return this.actionManager.getActionsByCategory(category);
    }

    getActionsByScope(scope: string): ActionDefinition[] {
        return this.actionManager.getActionsByScope(scope);
    }

    // Helper method to generate hotkey identifier
    private getHotkeyId(actionId: string, key: string): string {
        return `${actionId}::${key}`;
    }

    // Hotkey Management
    defineHotkey(hotkey: HotkeyDefinition): void {
        const hotkeyId = this.getHotkeyId(hotkey.actionId, hotkey.defaultKey);
        log.debug(`Defining hotkey: ${hotkeyId}`, hotkey);
        this.hotkeys.set(hotkeyId, hotkey);
        
        // Register the hotkey if the action exists and is in active scope
        const action = this.actionManager.getAction(hotkey.actionId);
        if (action && this.isScopeActive(action.scope)) {
            this.registerHotkey(hotkeyId);
        }
    }

    defineMultipleHotkeys(hotkeys: HotkeyDefinition[]): void {
        hotkeys.forEach((hotkey) => this.defineHotkey(hotkey));
    }

    getAllHotkeys(): Map<string, HotkeyDefinition> {
        return new Map(this.hotkeys);
    }

    getHotkeysByAction(actionId: string): HotkeyDefinition[] {
        return Array.from(this.hotkeys.values()).filter((hotkey) => hotkey.actionId === actionId);
    }

    removeHotkey(actionId: string, key: string): boolean {
        const hotkeyId = this.getHotkeyId(actionId, key);
        const hotkey = this.hotkeys.get(hotkeyId);
        if (!hotkey) return false;

        log.debug(`Removing hotkey: ${hotkeyId}`);
        
        // Unregister the hotkey first
        this.unregisterHotkey(hotkeyId);
        
        // Remove from hotkeys map
        this.hotkeys.delete(hotkeyId);
        
        // Remove from custom config if it exists
        delete this.customConfig[hotkeyId];
        this.saveConfig();
        
        return true;
    }

    // Combined view for backward compatibility and display purposes
    getAllDefinitions(): Map<string, ActionDefinition> {
        return this.actionManager.getAllActions();
    }

    getDefinitionsByCategory(category: string): ActionDefinition[] {
        return this.getActionsByCategory(category);
    }

    getDefinitionsByScope(scope: string): ActionDefinition[] {
        return this.getActionsByScope(scope);
    }

    // Check if a specific action is currently active
    isActionActive(actionId: string): boolean {
        const action = this.actionManager.getAction(actionId);
        if (!action) return false;
        return this.isScopeActive(action.scope);
    }

    // Check if a specific hotkey is currently active
    isHotkeyActive(hotkeyId: string): boolean {
        const hotkey = this.hotkeys.get(hotkeyId);
        if (!hotkey || hotkey.enabled === false) return false;
        const action = this.actionManager.getAction(hotkey.actionId);
        if (!action) return false;
        return this.isScopeActive(action.scope);
    }

    // Get all currently active actions
    getActiveActions(): Map<string, ActionDefinition> {
        const active = new Map<string, ActionDefinition>();
        this.actionManager.getAllActions().forEach((action, id) => {
            if (this.isActionActive(id)) {
                active.set(id, action);
            }
        });
        return active;
    }

    // Get all currently active hotkeys
    getActiveHotkeys(): Map<string, HotkeyDefinition> {
        const active = new Map<string, HotkeyDefinition>();
        this.hotkeys.forEach((hotkey, id) => {
            if (this.isHotkeyActive(id)) {
                active.set(id, hotkey);
            }
        });
        return active;
    }

    // Handler Management - now works with actions
    setHandler(actionId: string, handler: (event?: KeyboardEvent) => void): void {
        const action = this.actionManager.getAction(actionId);
        if (!action) {
            log.warn(`No action definition found for: ${actionId}`);
            return;
        }

        log.debug(`Setting handler for action: ${actionId}`);
        // Update the action's handler
        action.handler = handler;

        // Register all hotkeys for this action
        this.getHotkeysByAction(actionId).forEach(hotkey => {
            if (hotkey.enabled !== false) {
                const hotkeyId = this.getHotkeyId(hotkey.actionId, hotkey.defaultKey);
                this.registerHotkey(hotkeyId);
            }
        });
    }

    removeHandler(actionId: string): void {
        // Unregister all hotkeys for this action
        this.getHotkeysByAction(actionId).forEach(hotkey => {
            const hotkeyId = this.getHotkeyId(hotkey.actionId, hotkey.defaultKey);
            this.unregisterHotkey(hotkeyId);
        });
    }

    private registerHotkey(hotkeyId: string): void {
        const hotkey = this.hotkeys.get(hotkeyId);
        if (!hotkey || hotkey.enabled === false) return;

        const action = this.actionManager.getAction(hotkey.actionId);
        if (!action) return;

        const key = this.getCurrentKey(hotkey.actionId, hotkey.defaultKey);
        const scope = action.scope;
        const eventType = hotkey.eventType || "keydown";

        log.debug(
            `Registering hotkey: ${hotkeyId} -> action: ${hotkey.actionId} with key: ${key}, scope: ${scope}, eventType: ${eventType}`
        );

        // Unregister previous binding if exists
        this.unregisterHotkey(hotkeyId);

        // Track this key
        if (!this.registeredKeys.has(key)) {
            this.registeredKeys.set(key, new Set());
        }
        this.registeredKeys.get(key)!.add(hotkeyId);

        // Register with hotkeys-js for the specific event type
        // Use 'all' scope if we're in multi-scope mode, otherwise use the specific scope
        const hotkeysjsScope = this.exclusiveScope || "all";
        const currentHotkeysScope = hotkeys.getScope();
        log.debug(
            `Calling hotkeys() to register: ${key} in scope: ${hotkeysjsScope} (action scope: ${scope}), current hotkeys.js scope: ${currentHotkeysScope}`
        );
        hotkeys(
            key,
            { scope: hotkeysjsScope, keydown: false, keyup: false, [eventType]: true },
            (event, hotkeyHandler) => {
                log.debug(`Hotkey triggered: ${hotkeyId} -> action: ${hotkey.actionId}`, {
                    key,
                    scope,
                    event,
                    currentScope: hotkeys.getScope()
                });

                // Check if this scope is currently active
                if (!this.isScopeActive(scope)) {
                    log.debug(`Hotkey ${hotkeyId} blocked: scope not active`);
                    return true;
                }

                // Check if event is already handled by another component
                if (event.defaultPrevented) {
                    log.debug(`Hotkey ${hotkeyId} blocked: event already handled`);
                    return true;
                }

                log.debug(`Executing action handler: ${hotkey.actionId}`);
                event.preventDefault();
                action.handler(event);
                return false;
            }
        );
    }

    private unregisterHotkey(hotkeyId: string): void {
        const hotkey = this.hotkeys.get(hotkeyId);
        if (!hotkey) return;

        const action = this.actionManager.getAction(hotkey.actionId);
        if (!action) return;

        const key = this.getCurrentKey(hotkey.actionId, hotkey.defaultKey);
        const scope = action.scope;

        log.debug(`Unregistering hotkey: ${hotkeyId}`);

        // Remove from tracking
        if (this.registeredKeys.has(key)) {
            this.registeredKeys.get(key)!.delete(hotkeyId);
            if (this.registeredKeys.get(key)!.size === 0) {
                this.registeredKeys.delete(key);
            }
        }

        // Only unbind if no other hotkeys use this key in this scope
        const othersUsingKey = Array.from(this.hotkeys.values()).some(
            (hk) => {
                const hkId = this.getHotkeyId(hk.actionId, hk.defaultKey);
                if (hkId === hotkeyId) return false;
                const hkAction = this.actionManager.getAction(hk.actionId);
                return hkAction && this.getCurrentKey(hk.actionId, hk.defaultKey) === key && hkAction.scope === scope;
            }
        );

        if (!othersUsingKey) {
            hotkeys.unbind(key, scope);
        }
    }

    // Scope Management
    activateScope(scope: string): void {
        log.debug(`Activating scope: ${scope}`);
        this.activeScopes.add(scope);
        this.updateHotkeysScope();
    }

    deactivateScope(scope: string): void {
        log.debug(`Deactivating scope: ${scope}`);
        this.activeScopes.delete(scope);
        this.updateHotkeysScope();
    }

    setExclusiveScope(scope: string | null): void {
        log.debug(`Setting exclusive scope: ${scope}`);
        this.exclusiveScope = scope;
        this.updateHotkeysScope();
    }

    getActiveScopes(): Set<string> {
        return new Set(this.activeScopes);
    }

    private isScopeActive(scope: string): boolean {
        if (this.exclusiveScope) {
            return scope === this.exclusiveScope;
        }
        return this.activeScopes.has(scope);
    }

    private updateHotkeysScope(): void {
        if (this.exclusiveScope) {
            log.debug(`Setting hotkeys scope to exclusive: ${this.exclusiveScope}`);
            hotkeys.setScope(this.exclusiveScope);
        } else {
            // hotkeys-js doesn't support multiple scopes at once,
            // so we handle this in our event handler
            log.debug(`Setting hotkeys scope to: all`);
            hotkeys.setScope("all");
        }
    }

    // Configuration
    updateBinding(actionId: string, oldKey: string, newKey: string): void {
        const oldHotkeyId = this.getHotkeyId(actionId, oldKey);
        const hotkey = this.hotkeys.get(oldHotkeyId);
        if (!hotkey) {
            throw new Error(`No hotkey definition found for: ${oldHotkeyId}`);
        }

        const action = this.actionManager.getAction(actionId);
        if (!action) {
            throw new Error(`No action found for: ${actionId}`);
        }

        // Check if key is available
        if (!this.isKeyAvailable(newKey, action.scope, oldHotkeyId)) {
            throw new Error(`Key "${newKey}" is already in use in scope "${action.scope}"`);
        }

        log.debug(`Updating binding for ${oldHotkeyId}: ${this.getCurrentKey(actionId, oldKey)} -> ${newKey}`);
        
        // Remove old hotkey
        this.unregisterHotkey(oldHotkeyId);
        this.hotkeys.delete(oldHotkeyId);
        delete this.customConfig[oldHotkeyId];
        
        // Add new hotkey with updated key
        const newHotkeyId = this.getHotkeyId(actionId, newKey);
        const updatedHotkey = { ...hotkey, defaultKey: newKey };
        this.hotkeys.set(newHotkeyId, updatedHotkey);
        this.customConfig[newHotkeyId] = newKey;
        this.saveConfig();

        // Register the new hotkey
        this.registerHotkey(newHotkeyId);
    }

    getCurrentKey(actionId: string, defaultKey: string): string {
        const hotkeyId = this.getHotkeyId(actionId, defaultKey);
        const hotkey = this.hotkeys.get(hotkeyId);
        if (!hotkey) return "";

        return this.customConfig[hotkeyId] || hotkey.defaultKey;
    }

    resetToDefaults(): void {
        this.customConfig = {};
        this.saveConfig();

        // Re-register all active hotkeys
        this.hotkeys.forEach((hotkey, hotkeyId) => {
            const action = this.actionManager.getAction(hotkey.actionId);
            if (action && this.isScopeActive(action.scope)) {
                this.registerHotkey(hotkeyId);
            }
        });
    }

    resetSingleToDefault(actionId: string, key: string): void {
        const hotkeyId = this.getHotkeyId(actionId, key);
        delete this.customConfig[hotkeyId];
        this.saveConfig();

        const hotkey = this.hotkeys.get(hotkeyId);
        if (hotkey) {
            const action = this.actionManager.getAction(actionId);
            if (action && this.isScopeActive(action.scope)) {
                this.registerHotkey(hotkeyId);
            }
        }
    }

    isKeyAvailable(key: string, scope: string, excludeHotkeyId?: string): boolean {
        for (const [hotkeyId, hotkey] of this.hotkeys) {
            if (hotkeyId === excludeHotkeyId) continue;

            const action = this.actionManager.getAction(hotkey.actionId);
            if (!action) continue;

            const currentKey = this.getCurrentKey(hotkey.actionId, hotkey.defaultKey);
            if (currentKey === key && action.scope === scope) {
                return false;
            }
        }
        return true;
    }

    getActionUsingKey(key: string, scope: string, excludeHotkeyId?: string): ActionDefinition | null {
        for (const [hotkeyId, hotkey] of this.hotkeys) {
            if (hotkeyId === excludeHotkeyId) continue;

            const action = this.actionManager.getAction(hotkey.actionId);
            if (!action) continue;

            const currentKey = this.getCurrentKey(hotkey.actionId, hotkey.defaultKey);
            if (currentKey === key && action.scope === scope) {
                return action;
            }
        }
        return null;
    }

    // Utility
    formatKeyCombo(event: KeyboardEvent | React.KeyboardEvent): string {
        const keys = [];

        if (event.ctrlKey || event.metaKey) keys.push("ctrl");
        if (event.altKey) keys.push("alt");
        if (event.shiftKey) keys.push("shift");

        // Add the actual key
        let key = event.key.toLowerCase();
        if (!["control", "alt", "shift", "meta"].includes(key)) {
            // Normalize key names to match hotkeys-js format
            if (key === "escape") key = "esc";
            if (key === " ") key = "space";
            keys.push(key);
        }

        return keys.join("+");
    }

    parseKeyCombo(combo: string): string {
        // Normalize key combo for display
        return combo
            .replace(/\s+/g, "")
            .split("+")
            .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
            .join(" + ");
    }

    // Cleanup
    destroy(): void {
        this.actionManager.clearActions();
        this.hotkeys.clear();
        this.activeScopes.clear();
        this.registeredKeys.clear();
        hotkeys.unbind();
    }

    private saveConfig(): void {
        localStorage.setItem(HOTKEY_CONFIG_LOCAL_STORAGE_KEY, JSON.stringify(this.customConfig));
    }
}

export function useHotkeyScope(scope: string, exclusive: boolean = false): void {
    const { hotkeyManager } = useFilez();

    useEffect(() => {
        if (exclusive) {
            const previousScope = hotkeyManager.getActiveScopes();
            hotkeyManager.setExclusiveScope(scope);

            return () => {
                hotkeyManager.setExclusiveScope(null);
                previousScope.forEach((s) => hotkeyManager.activateScope(s));
            };
        } else {
            hotkeyManager.activateScope(scope);

            return () => {
                hotkeyManager.deactivateScope(scope);
            };
        }
    }, [scope, exclusive, hotkeys]);
}

// Hook for registering handlers
export function useHotkey(
    hotkeyId: string,
    handler: (event?: KeyboardEvent) => void,
    deps: React.DependencyList = []
): void {
    const { hotkeyManager } = useFilez();

    useEffect(() => {
        hotkeyManager.setHandler(hotkeyId, handler);

        return () => {
            hotkeyManager.removeHandler(hotkeyId);
        };
    }, [hotkeyId, hotkeys, ...deps]);
}
