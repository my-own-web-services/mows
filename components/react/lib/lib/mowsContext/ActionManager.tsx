import { JSX } from "react";
import { log } from "../logging";

export interface ActionState {
    visibility: ActionVisibility;
    disabledReasonText?: string;
    /**
     * Optional leading icon. Rendered to the left of the action label by
     * `ActionDisplay`; ignored when `component` is set (which replaces the
     * whole label cell).
     */
    icon?: () => JSX.Element;
    component?: () => JSX.Element;
}

export enum ActionVisibility {
    Shown = `Shown`,
    Disabled = `Disabled`,
    Hidden = `Hidden`
}

export interface ActionConstructorParams {
    id: string;
    category: string;
    actionHandlers?: Map<string, ActionHandler>;
    hideInCommandPalette?: boolean;
    doNotTrackUsage?: boolean;
}

export class Action {
    id: string;
    category: string;
    actionHandlers: Map<string, ActionHandler>;
    hideInCommandPalette?: boolean;
    doNotTrackUsage?: boolean;

    constructor(params: ActionConstructorParams) {
        this.id = params.id;
        this.category = params.category;
        this.actionHandlers = params.actionHandlers ?? new Map();
        this.hideInCommandPalette = params.hideInCommandPalette ?? false;
        this.doNotTrackUsage = params.doNotTrackUsage ?? false;
    }

    getCurrentHandler = (): ActionHandler | undefined => {
        return this.actionHandlers.entries().next().value?.[1];
    };

    getState = (): ActionState => {
        const handler = this.getCurrentHandler();
        if (!handler) {
            log.warn(`No handler defined for action: ${this.id}`);
            return { visibility: ActionVisibility.Hidden, disabledReasonText: `No handler defined` };
        }
        if (!handler.executeAction) {
            log.warn(`No executeAction function defined for action: ${this.id}`);
            return {
                visibility: ActionVisibility.Hidden,
                disabledReasonText: `No executeAction function defined`
            };
        }

        return handler.getState();
    };
}

export interface ActionHandler {
    id: string;
    scopes?: string[];
    executeAction?: (event?: KeyboardEvent) => void;
    getState: () => ActionState;
}

export interface RecentAction {
    actionId: string;
    timestamp: number;
}

export interface ActionManagerConfig {
    recentActionsStorageKey: string;
    maxRecentActions: number;
}

export class ActionManager {
    private actions: Map<string, Action> = new Map();
    private recentActions: RecentAction[] = [];
    private config: ActionManagerConfig;

    constructor(config: ActionManagerConfig) {
        this.config = config;
    }

    dispatchAction = (actionId: string) => {
        const action = this.actions.get(actionId);

        if (action) {
            log.debug(`Dispatching action: ${actionId}`);
            const actionHandler = action.getCurrentHandler();
            if (!actionHandler) {
                log.warn(`No handler defined for action: ${actionId}`);
                return;
            }

            if (!actionHandler.executeAction) {
                log.warn(`No executeAction function defined for action: ${actionId}`);
                return;
            }

            this.trackCommandUsage(action);

            actionHandler.executeAction();
        } else {
            log.warn(`Action not found: ${actionId}`);
        }
    };

    getAction = (actionId: string): Action | undefined => {
        return this.actions.get(actionId);
    };

    defineAction(action: Action): void {
        log.debug(`Defining action: ${action.id}`, action);
        this.actions.set(action.id, action);
    }

    defineMultipleActions(actions: Action[]): void {
        actions.forEach((action) => this.defineAction(action));
    }

    getActionHandlersByScope = (scope: string): ActionHandler[] => {
        const handlers: ActionHandler[] = [];
        this.actions.forEach((action) => {
            action.actionHandlers.forEach((handler) => {
                if (handler.scopes?.includes(scope)) {
                    handlers.push(handler);
                }
            });
        });
        return handlers;
    };

    getActionsByHandlerScope = (scope: string): Action[] => {
        const actions: Action[] = [];
        this.actions.forEach((action) => {
            action.actionHandlers.forEach((handler) => {
                if (handler.scopes?.includes(scope)) {
                    actions.push(action);
                }
            });
        });
        return actions;
    };

    getAllActions = (): Map<string, Action> => {
        return this.actions;
    };

    getActionsByCategory = (category: string): Action[] => {
        return Array.from(this.actions.values()).filter((action) => action.category === category);
    };

    getCategories = (): string[] => {
        const categories = new Set<string>();
        this.actions.forEach((action) => categories.add(action.category));
        return Array.from(categories).sort();
    };

    registerActionHandler = (actionId: string, actionHandler: ActionHandler): void => {
        log.debug(`Setting handler for action: ${actionId}`);
        const existingAction = this.actions.get(actionId);

        if (existingAction) {
            const existingActionHandler = existingAction.actionHandlers.get(actionHandler.id);

            if (existingActionHandler) {
                log.warn(
                    `Action handler already registered for action: ${actionId} with handler ID: ${actionHandler.id}`
                );
                return;
            }
            this.actions.set(actionId, {
                ...existingAction,
                actionHandlers: existingAction.actionHandlers.set(actionHandler.id, actionHandler)
            });
        }
    };

    unregisterActionHandler = (actionId: string, actionHandlerId: string): void => {
        log.debug(`Unsetting handler for action: ${actionId}`);
        const existingAction = this.actions.get(actionId);

        if (existingAction) {
            const existingActionHandler = existingAction.actionHandlers.get(actionHandlerId);

            if (!existingActionHandler) {
                log.warn(
                    `No action handler found for action: ${actionId} with handler ID: ${actionHandlerId}`
                );
                return;
            }

            existingAction.actionHandlers.delete(actionHandlerId);
        }
    };

    trackCommandUsage = (action: Action): void => {
        log.debug(`trackCommandUsage called for action: ${action.id}`);
        log.debug(`Action retrieved for tracking:`, action);
        if (action.doNotTrackUsage) {
            log.debug(`Not tracking usage for action: ${action.id} (doNotTrackUsage is true)`);
            return;
        }
        log.debug(`Tracking usage for action: ${action.id}`);
        const recentCommands = this.getRecentCommands();
        const now = Date.now();
        const updatedCommands = [
            { actionId: action.id, timestamp: now },
            ...recentCommands.filter((command) => command.actionId !== action.id)
        ].slice(0, this.config.maxRecentActions);
        this.recentActions = updatedCommands;
        this.saveRecentActions();
    };

    loadRecentActions = () => {
        const stored = localStorage.getItem(this.config.recentActionsStorageKey);
        if (stored) {
            try {
                this.recentActions = JSON.parse(stored) as RecentAction[];
            } catch (e) {
                log.error(`Failed to parse recent actions from localStorage`, e);
                this.recentActions = [];
            }
        } else {
            this.recentActions = [];
        }
    };

    saveRecentActions = () => {
        localStorage.setItem(
            this.config.recentActionsStorageKey,
            JSON.stringify(this.recentActions)
        );
    };

    getRecentCommands = (): RecentAction[] => {
        return this.recentActions
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, this.config.maxRecentActions);
    };
}
