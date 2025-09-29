import { FILEZ_MAXIMUM_RECENT_ACTIONS, FILEZ_RECENT_ACTIONS_STORAGE_KEY } from "../constants";
import { log } from "../logging";

// Action definition - what should happen when triggered
export interface ActionDefinition {
    id: string;
    category: string;
    scope: string;
    hideInCommandPalette?: boolean;
    doNotTrackUsage?: boolean;
    handler?: (event?: KeyboardEvent) => void;
}

export interface RecentAction {
    actionId: string;
    timestamp: number;
}

// Create the action manager
export class ActionManager {
    private actions: Map<string, ActionDefinition> = new Map();
    private recentActions: RecentAction[] = [];

    constructor() {
        log.debug("ActionManager constructor");
    }

    dispatchAction = (actionId: string) => {
        const action = this.actions.get(actionId);

        if (action) {
            log.debug(`Dispatching action: ${actionId}`);
            if (!action.handler) {
                log.warn(`No handler defined for action: ${actionId}`);
                return;
            }
            this.trackCommandUsage(action);

            action.handler();
        } else {
            log.warn(`Action not found: ${actionId}`);
        }
    };

    getAction = (actionId: string): ActionDefinition | undefined => {
        return this.actions.get(actionId);
    };

    // Action Management
    defineAction(action: ActionDefinition): void {
        log.debug(`Defining action: ${action.id}`, action);
        this.actions.set(action.id, action);
    }

    defineMultipleActions(actions: ActionDefinition[]): void {
        actions.forEach((action) => this.defineAction(action));
    }

    getAllActions = (): Map<string, ActionDefinition> => {
        return this.actions;
    };

    getActionsByCategory = (category: string): ActionDefinition[] => {
        return Array.from(this.actions.values()).filter((action) => action.category === category);
    };

    getActionsByScope = (scope: string): ActionDefinition[] => {
        return Array.from(this.actions.values()).filter((action) => action.scope === scope);
    };

    getCategories = (): string[] => {
        const categories = new Set<string>();
        this.actions.forEach((action) => categories.add(action.category));
        return Array.from(categories).sort();
    };

    getScopes = (): string[] => {
        const scopes = new Set<string>();
        this.actions.forEach((action) => scopes.add(action.scope));
        return Array.from(scopes).sort();
    };

    setHandler = (actionId: string, handler: (event?: KeyboardEvent) => void): void => {
        log.debug(`Setting handler for action: ${actionId}`);
        const existingAction = this.actions.get(actionId);

        if (existingAction) {
            this.actions.set(actionId, {
                ...existingAction,
                handler
            });
        }
    };

    handlerExists = (actionId: string): boolean => {
        const action = this.actions.get(actionId);
        return !!(action && action.handler);
    };

    trackCommandUsage = (action: ActionDefinition): void => {
        log.debug(`trackCommandUsage called for action: ${action.id}`);
        log.debug(`Action retrieved for tracking:`, action);
        if (!action || action.doNotTrackUsage) return;
        log.debug(`Tracking usage for action: ${action.id}`);
        const recentCommands = this.getRecentCommands();
        const now = Date.now();
        const updatedCommands = [
            { actionId: action.id, timestamp: now },
            ...recentCommands.filter((cmd) => cmd.actionId !== action.id)
        ].slice(0, FILEZ_MAXIMUM_RECENT_ACTIONS);
        this.recentActions = updatedCommands;
        this.saveRecentActions();
    };

    loadRecentActions = () => {
        const stored = localStorage.getItem(FILEZ_RECENT_ACTIONS_STORAGE_KEY);
        if (stored) {
            try {
                this.recentActions = JSON.parse(stored) as RecentAction[];
            } catch (e) {
                log.error("Failed to parse recent actions from localStorage", e);
                this.recentActions = [];
            }
        } else {
            this.recentActions = [];
        }
    };

    saveRecentActions = () => {
        localStorage.setItem(FILEZ_RECENT_ACTIONS_STORAGE_KEY, JSON.stringify(this.recentActions));
    };

    getRecentCommands = (): RecentAction[] => {
        return this.recentActions
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, FILEZ_MAXIMUM_RECENT_ACTIONS);
    };
}
