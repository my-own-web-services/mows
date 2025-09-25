import { log } from "./logging";

// Action definition - what should happen when triggered
export interface ActionDefinition {
    id: string;
    category: string;
    scope: string;
    handler: (event?: KeyboardEvent) => void;
}

// Create the action manager
export class ActionManager {
    private actions: Map<string, ActionDefinition> = new Map();

    constructor() {
        log.debug("ActionManager constructor");
    }

    // Action Management
    defineAction(action: ActionDefinition): void {
        log.debug(`Defining action: ${action.id}`, action);
        this.actions.set(action.id, action);
    }

    defineMultipleActions(actions: ActionDefinition[]): void {
        actions.forEach((action) => this.defineAction(action));
    }

    getAction(actionId: string): ActionDefinition | undefined {
        return this.actions.get(actionId);
    }

    getAllActions(): Map<string, ActionDefinition> {
        return this.actions;
    }

    getActionsByCategory(category: string): ActionDefinition[] {
        return Array.from(this.actions.values()).filter((action) => action.category === category);
    }

    getActionsByScope(scope: string): ActionDefinition[] {
        return Array.from(this.actions.values()).filter((action) => action.scope === scope);
    }

    removeAction(actionId: string): void {
        this.actions.delete(actionId);
    }

    clearActions(): void {
        this.actions.clear();
    }

    hasAction(actionId: string): boolean {
        return this.actions.has(actionId);
    }

    getActionCount(): number {
        return this.actions.size;
    }

    getCategories(): string[] {
        const categories = new Set<string>();
        this.actions.forEach((action) => categories.add(action.category));
        return Array.from(categories).sort();
    }

    getScopes(): string[] {
        const scopes = new Set<string>();
        this.actions.forEach((action) => scopes.add(action.scope));
        return Array.from(scopes).sort();
    }
}